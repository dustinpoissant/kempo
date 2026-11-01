import path from 'path';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  How the page builder treats a page file and its row: opening (and what state that finds), saving, the conflict between a
  file and the builder's copy, leaving code mode, the pages' own management (copy, move over another, disable, enable and
  delete take the row along), templates and the widgets extensions declare. Against the in-memory database of the unit
  tier, with real files in a temporary directory.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { sitebuilderPage, sitebuilderTemplate, extension } = await load('server/db/schema.js');
const openPage = (await load('server/utils/sitebuilder/openPage.js')).default;
const savePage = (await load('server/utils/sitebuilder/savePage.js')).default;
const resolveConflict = (await load('server/utils/sitebuilder/resolveConflict.js')).default;
const leaveCodeMode = (await load('server/utils/sitebuilder/leaveCodeMode.js')).default;
const { getRow, saveRow } = await load('server/utils/sitebuilder/rows.js');
const { hashFile } = await load('server/utils/sitebuilder/pageFile.js');
const { loadExtensionWidgets } = await load('server/utils/sitebuilder/registry.js');
const createTemplate = (await load('server/utils/sitebuilder/templates/createTemplate.js')).default;
const listTemplates = (await load('server/utils/sitebuilder/templates/listTemplates.js')).default;
const deleteTemplate = (await load('server/utils/sitebuilder/templates/deleteTemplate.js')).default;
const movePage = (await load('server/utils/pages/movePage.js')).default;
const copyPage = (await load('server/utils/pages/copyPage.js')).default;
const disablePage = (await load('server/utils/pages/disablePage.js')).default;
const enablePage = (await load('server/utils/pages/enablePage.js')).default;
const deletePage = (await load('server/utils/pages/deletePage.js')).default;

const databaseReachable = await reachable(db);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const TEMPLATE = '<!DOCTYPE html>\n<html><head><location name="head" /></head><body><main><location /></main><location name="scripts" /></body></html>\n';

const pageText = (body, { head = '', title = 'Test', attributes = '' } = {}) => `<!--\n  owner: custom\n  name: ${title}\n  author: tester\n  created: 2026-01-01T00:00:00.000Z\n  updated: 2026-01-01T00:00:00.000Z\n-->\n<page template="default" title="${title}"${attributes}>\n${head ? `<content location="head">\n${head}\n</content>\n` : ''}<content>\n${body}\n</content>\n</page>\n`;

const withSite = fn => async ({ pass, fail, skip }) => {
  if(!databaseReachable) return pass('skipped: no database');
  const dir = await mkdtemp(path.join(tmpdir(), 'kempo-sitebuilder-'));
  try {
    await writeFile(path.join(dir, 'default.template.html'), TEMPLATE);
    await fn(dir);
    pass('');
  } catch(error) {
    fail(error.message);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await db.delete(sitebuilderPage);
  }
};

const write = async (dir, file, content) => {
  await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
  await writeFile(path.join(dir, file), content);
};

const read = (dir, file) => readFile(path.join(dir, file), 'utf-8');

const ok = ([error, data], what) => {
  if(error) throw new Error(`${what}: ${error.code} ${error.msg}`);
  return data;
};

const BUILDER_PAGE = '<h2>Hello</h2>\n<p>Some <b>text</b></p>\n<div class="row">\n<div class="span-6 m-span-12">\n<a class="btn" href="/a">A</a>\n</div>\n<div class="span-6 m-span-12">\n<hr>\n</div>\n</div>';

export default {
  'a page the builder has not seen is rebuilt into a tree, which is stored with the hash of the file': withSite(async dir => {
    await write(dir, 'a.page.html', pageText(BUILDER_PAGE));
    const page = ok(await openPage({ rootDir: dir, file: 'a.page.html' }), 'open');
    expect(page.state === 'builder', `state ${page.state}`);
    expect(page.trees.default.map(node => node.type).join() === 'markup,row', page.trees.default.map(node => node.type).join());
    const row = await getRow('a.page.html');
    expect(row && row.fileHash === hashFile(await read(dir, 'a.page.html')) && !row.codeOnly, 'row stored');
    expect(ok(await openPage({ rootDir: dir, file: 'a.page.html' }), 'open again').hash === page.hash, 'opening does not change the file');
  }),

  'a page the builder cannot rebuild exactly opens as code, and says why': withSite(async dir => {
    await write(dir, 'b.page.html', pageText('<p>x</p>\n<iframe src="/x"></iframe>'));
    const page = ok(await openPage({ rootDir: dir, file: 'b.page.html' }), 'open');
    expect(page.state === 'code' && /iframe/.test(page.reason), `${page.state} ${page.reason}`);
    expect(page.blocks.some(block => block.location === 'default' && block.content.includes('<iframe')), 'the code is returned');
    expect((await getRow('b.page.html')).codeOnly === true, 'row is code-only');
    expect(!existsSync(path.join(dir, 'b.page.html.bak')) && (await read(dir, 'b.page.html')).includes('<iframe'), 'file untouched');
  }),

  'saving writes the file and the row together, keeps the head, the settings and the extra page attributes, and cleans what it is sent': withSite(async dir => {
    await write(dir, 'c.page.html', pageText('<p>old</p>', { head: '<meta name="x" content="1">', attributes: ' status="published"' }));
    const opened = ok(await openPage({ rootDir: dir, file: 'c.page.html' }), 'open');
    const trees = { default: [{ id: 'm1', type: 'markup', attrs: { html: '<p>new <b>text</b></p><script>alert(1)</script>' }, slots: {} }, { id: 'b1', type: 'button', attrs: { label: 'Go', href: '/go' }, slots: {} }] };
    const saved = ok(await savePage({ rootDir: dir, file: 'c.page.html', trees, changes: { title: 'New title', description: 'About it' }, loadedHash: opened.hash }), 'save');
    const file = await read(dir, 'c.page.html');
    expect(file.includes('<p>new <b>text</b></p>') && !file.includes('alert') && file.includes('<a class="btn" href="/go">Go</a>'), file);
    expect(file.includes('<meta name="x" content="1">') && file.includes('status="published"') && file.includes('title="New title"') && file.includes('description: About it'), file);
    expect(saved.hash === hashFile(file) && (await getRow('c.page.html')).fileHash === saved.hash, 'hashes agree');
    const again = ok(await openPage({ rootDir: dir, file: 'c.page.html' }), 'reopen');
    expect(again.state === 'builder' && again.trees.default[1].type === 'button', 'reopens from the row');
  }),

  'saving over a page that changed after it was opened is refused, and changes nothing': withSite(async dir => {
    await write(dir, 'd.page.html', pageText('<p>one</p>'));
    const opened = ok(await openPage({ rootDir: dir, file: 'd.page.html' }), 'open');
    await write(dir, 'd.page.html', pageText('<p>two</p>'));
    const before = await read(dir, 'd.page.html');
    const [error] = await savePage({ rootDir: dir, file: 'd.page.html', trees: { default: [] }, loadedHash: opened.hash });
    expect(error && error.code === 409, 'not refused');
    expect(await read(dir, 'd.page.html') === before, 'the file changed');
    const [noHash] = await savePage({ rootDir: dir, file: 'd.page.html', trees: { default: [] } });
    expect(noHash && noHash.code === 409, 'a save with no hash is refused too');
  }),

  'a tree the server will not accept is refused without writing anything': withSite(async dir => {
    await write(dir, 'e.page.html', pageText('<p>safe</p>'));
    const opened = ok(await openPage({ rootDir: dir, file: 'e.page.html' }), 'open');
    const before = await read(dir, 'e.page.html');
    const [error] = await savePage({ rootDir: dir, file: 'e.page.html', trees: { default: [{ id: 'x', type: 'not-a-widget', attrs: {}, slots: {} }] }, loadedHash: opened.hash });
    expect(error && error.code === 400, `${error?.code}`);
    expect(await read(dir, 'e.page.html') === before, 'the file changed');
  }),

  'a change outside the builder that says the same thing is accepted without asking': withSite(async dir => {
    await write(dir, 'f.page.html', pageText('<p>hello</p>'));
    const first = ok(await openPage({ rootDir: dir, file: 'f.page.html' }), 'open');
    await write(dir, 'f.page.html', pageText('<p>\n      hello\n</p>'));
    const again = ok(await openPage({ rootDir: dir, file: 'f.page.html' }), 'open again');
    expect(again.state === 'builder' && again.hash !== first.hash, `state ${again.state}`);
    expect((await getRow('f.page.html')).fileHash === again.hash, 'the row follows the file');
  }),

  'a change outside the builder that says something else is a conflict, and keeping the file rebuilds the tree from it': withSite(async dir => {
    await write(dir, 'g.page.html', pageText('<p>builder</p>'));
    ok(await openPage({ rootDir: dir, file: 'g.page.html' }), 'open');
    await write(dir, 'g.page.html', pageText('<p>edited by hand</p>\n<hr>'));
    const conflict = ok(await openPage({ rootDir: dir, file: 'g.page.html' }), 'open changed');
    expect(conflict.state === 'conflict' && conflict.conflict.fileRebuildable, `state ${conflict.state}`);
    expect(conflict.conflict.filePreview.includes('edited by hand') && conflict.conflict.rowPreview.includes('builder'), 'both previews');
    const kept = ok(await resolveConflict({ rootDir: dir, file: 'g.page.html', keep: 'file', loadedHash: conflict.hash }), 'keep file');
    expect(kept.state === 'builder' && kept.trees.default.map(node => node.type).join() === 'markup,divider', kept.trees.default.map(node => node.type).join());
    expect((await read(dir, 'g.page.html')).includes('edited by hand'), 'the file is as it was');
  }),

  'keeping the builder\'s copy renders it over the file': withSite(async dir => {
    await write(dir, 'h.page.html', pageText('<p>builder</p>', { head: '<meta name="keep" content="me">' }));
    ok(await openPage({ rootDir: dir, file: 'h.page.html' }), 'open');
    await write(dir, 'h.page.html', pageText('<p>hand</p>', { head: '<meta name="keep" content="me">' }));
    const conflict = ok(await openPage({ rootDir: dir, file: 'h.page.html' }), 'open changed');
    expect(conflict.state === 'conflict', conflict.state);
    const kept = ok(await resolveConflict({ rootDir: dir, file: 'h.page.html', keep: 'row', loadedHash: conflict.hash }), 'keep row');
    const file = await read(dir, 'h.page.html');
    expect(kept.state === 'builder' && file.includes('<p>builder</p>') && !file.includes('hand') && file.includes('name="keep"'), file);
    expect((await getRow('h.page.html')).fileHash === hashFile(file), 'hash');
  }),

  'a choice made on a file that changed again is refused': withSite(async dir => {
    await write(dir, 'i.page.html', pageText('<p>a</p>'));
    ok(await openPage({ rootDir: dir, file: 'i.page.html' }), 'open');
    await write(dir, 'i.page.html', pageText('<p>b</p>'));
    const conflict = ok(await openPage({ rootDir: dir, file: 'i.page.html' }), 'open changed');
    await write(dir, 'i.page.html', pageText('<p>c</p>'));
    const [error] = await resolveConflict({ rootDir: dir, file: 'i.page.html', keep: 'row', loadedHash: conflict.hash });
    expect(error && error.code === 409, 'applied to a different file');
    expect((await resolveConflict({ rootDir: dir, file: 'i.page.html', keep: 'maybe', loadedHash: conflict.hash }))[0].code === 400, 'a choice must be file or row');
  }),

  'keeping a file the builder cannot rebuild makes the page code-only and keeps the last good tree': withSite(async dir => {
    await write(dir, 'j.page.html', pageText('<p>good</p>'));
    ok(await openPage({ rootDir: dir, file: 'j.page.html' }), 'open');
    await write(dir, 'j.page.html', pageText('<p>good</p>\n<style>p{}</style>'));
    const conflict = ok(await openPage({ rootDir: dir, file: 'j.page.html' }), 'open changed');
    expect(conflict.state === 'conflict' && !conflict.conflict.fileRebuildable && /style/.test(conflict.conflict.fileReason), 'the dialog can warn first');
    const code = ok(await resolveConflict({ rootDir: dir, file: 'j.page.html', keep: 'file', loadedHash: conflict.hash }), 'keep file');
    expect(code.state === 'code' && code.hasLastGood, `${code.state} ${code.hasLastGood}`);
    expect((await getRow('j.page.html')).codeOnly, 'row is code-only');
  }),

  'leaving code mode either wipes the page or brings back the last good one, and keeps the head and scripts': withSite(async dir => {
    await write(dir, 'k.page.html', pageText('<p>good one</p>', { head: '<meta name="head" content="kept">' }));
    ok(await openPage({ rootDir: dir, file: 'k.page.html' }), 'open');
    await write(dir, 'k.page.html', pageText('<p>good one</p>\n<iframe src="/x"></iframe>', { head: '<meta name="head" content="kept">' }));
    const conflict = ok(await openPage({ rootDir: dir, file: 'k.page.html' }), 'open changed');
    const code = ok(await resolveConflict({ rootDir: dir, file: 'k.page.html', keep: 'file', loadedHash: conflict.hash }), 'keep file');
    const back = ok(await leaveCodeMode({ rootDir: dir, file: 'k.page.html', mode: 'lastGood', loadedHash: code.hash }), 'last good');
    let file = await read(dir, 'k.page.html');
    expect(back.state === 'builder' && file.includes('good one') && !file.includes('iframe') && file.includes('name="head"'), file);

    await write(dir, 'k.page.html', pageText('<p>x</p>\n<iframe src="/x"></iframe>', { head: '<meta name="head" content="kept">' }));
    const again = ok(await openPage({ rootDir: dir, file: 'k.page.html' }), 'open again');
    expect(again.state === 'conflict' || again.state === 'code', again.state);
    const settled = again.state === 'conflict' ? ok(await resolveConflict({ rootDir: dir, file: 'k.page.html', keep: 'file', loadedHash: again.hash }), 'keep') : again;
    const empty = ok(await leaveCodeMode({ rootDir: dir, file: 'k.page.html', mode: 'empty', loadedHash: settled.hash }), 'empty');
    file = await read(dir, 'k.page.html');
    expect(empty.state === 'builder' && empty.trees.default.length === 0 && !file.includes('iframe') && file.includes('name="head"'), file);
    expect(ok(await openPage({ rootDir: dir, file: 'k.page.html' }), 'reopen').state === 'builder', 'and it stays in the builder');
    const [noGood] = await leaveCodeMode({ rootDir: dir, file: 'k.page.html', mode: 'nonsense', loadedHash: empty.hash });
    expect(noGood.code === 400, 'a mode must be given');
  }),

  'the scripts location holds Script widgets, and a page the builder saved before that is read from its file, not emptied': withSite(async dir => {
    const text = pageText('<p>x</p>').replace('</page>', '<content location="scripts">\n<script src="/a.js" defer></script>\n<script>console.log(1)</script>\n</content>\n</page>');
    await write(dir, 'm.page.html', text);
    await saveRow({ file: 'm.page.html', trees: { default: [{ id: 'p', type: 'markup', attrs: { html: '<p>x</p>' }, slots: {} }] }, fileHash: hashFile(text) });
    const page = ok(await openPage({ rootDir: dir, file: 'm.page.html' }), 'open');
    const scripts = page.trees?.scripts || [];
    expect(page.state === 'builder', page.state + ' ' + (page.reason || ''));
    expect(page.state === 'builder' && page.locations.find(location => location.name === 'scripts')?.code === false, 'scripts is a widget location');
    expect(scripts.length === 2 && scripts[0].attrs.src === '/a.js' && scripts[0].attrs.defer === true && scripts[1].attrs.code === 'console.log(1)', JSON.stringify(scripts));
    ok(await savePage({ rootDir: dir, file: 'm.page.html', trees: page.trees, loadedHash: page.hash }), 'save');
    const file = await read(dir, 'm.page.html');
    expect(file.includes('<script src="/a.js" defer></script>') && file.includes('console.log(1)'), file);
  }),

  'a tree that uses a widget which is no longer installed is rebuilt from the file instead of being lost': withSite(async dir => {
    await write(dir, 'l.page.html', pageText('<k-gone a="1"><p>inside</p></k-gone>\n<hr>'));
    const hash = hashFile(await read(dir, 'l.page.html'));
    await saveRow({ file: 'l.page.html', trees: { default: [{ id: 'g', type: 'gone-ext:widget', attrs: {}, slots: {} }] }, fileHash: hash });
    const page = ok(await openPage({ rootDir: dir, file: 'l.page.html' }), 'open');
    expect(page.state === 'builder' && page.trees.default[0].type === 'unknown' && page.trees.default[0].attrs.html.includes('k-gone'), JSON.stringify(page.trees.default[0]));
    const saved = ok(await savePage({ rootDir: dir, file: 'l.page.html', trees: page.trees, loadedHash: page.hash }), 'save');
    expect((await read(dir, 'l.page.html')).includes('<k-gone a="1">'), 'it is written back as it was');
    expect(saved.trees.default[0].type === 'unknown', 'still unknown');
  }),

  'copying a page copies its row, moving and disabling it carry the row, and deleting it removes the row': withSite(async dir => {
    await write(dir, 'm.page.html', pageText('<p>m</p>'));
    ok(await openPage({ rootDir: dir, file: 'm.page.html' }), 'open');
    const copy = ok(await copyPage({ rootDir: dir, file: 'm.page.html', newFile: 'sub/m-draft.page.html' }), 'copy');
    const copyRow = await getRow(copy.file);
    expect(copyRow && copyRow.fileHash === hashFile(await read(dir, copy.file)), 'copy row has the copy\'s own hash');
    expect((await read(dir, copy.file)).includes('owner: custom') && ok(await openPage({ rootDir: dir, file: copy.file }), 'open copy').state === 'builder', 'the copy opens in the builder');
    expect((await copyPage({ rootDir: dir, file: 'm.page.html', newFile: 'sub/m-draft.page.html' }))[0].code === 409, 'will not overwrite');

    ok(await movePage({ rootDir: dir, file: 'm.page.html', newFile: 'moved/m.page.html' }), 'move');
    expect(!(await getRow('m.page.html')) && await getRow('moved/m.page.html'), 'row moved');
    ok(await disablePage({ rootDir: dir, file: 'moved/m.page.html' }), 'disable');
    expect(await getRow('moved/m.page-disabled.html'), 'row follows a disable');
    ok(await enablePage({ rootDir: dir, file: 'moved/m.page-disabled.html' }), 'enable');
    expect(await getRow('moved/m.page.html'), 'row follows an enable');
    ok(await deletePage({ rootDir: dir, files: ['moved/m.page.html'] }), 'delete');
    expect(!(await getRow('moved/m.page.html')), 'row deleted with the page');
  }),

  'a page can replace another only when asked to, and only a custom unlocked one': withSite(async dir => {
    await write(dir, 'draft.page.html', pageText('<p>the draft</p>'));
    await write(dir, 'live.page.html', pageText('<p>the live page</p>'));
    ok(await openPage({ rootDir: dir, file: 'draft.page.html' }), 'open draft');
    ok(await openPage({ rootDir: dir, file: 'live.page.html' }), 'open live');
    expect((await movePage({ rootDir: dir, file: 'draft.page.html', newFile: 'live.page.html' }))[0].code === 409, 'refused without overwrite');
    ok(await movePage({ rootDir: dir, file: 'draft.page.html', newFile: 'live.page.html', overwrite: true }), 'replace');
    expect((await read(dir, 'live.page.html')).includes('the draft') && !existsSync(path.join(dir, 'draft.page.html')), 'replaced');
    const row = await getRow('live.page.html');
    expect(row && !(await getRow('draft.page.html')) && row.fileHash === hashFile(await read(dir, 'live.page.html')), 'the draft\'s row replaced the live one');
    await write(dir, 'locked.page.html', pageText('<p>locked</p>').replace('owner: custom', 'owner: custom\n  locked: true'));
    await write(dir, 'other.page.html', pageText('<p>other</p>'));
    expect((await movePage({ rootDir: dir, file: 'other.page.html', newFile: 'locked.page.html', overwrite: true }))[0].code === 403, 'a locked page cannot be replaced');
    expect((await movePage({ rootDir: dir, file: 'other.page.html', newFile: 'other.page.html', overwrite: true }))[0], 'a page cannot replace itself');
  }),

  'templates are saved cleaned, listed and deleted': async ({ pass, fail }) => {
    if(!databaseReachable) return pass('skipped: no database');
    try {
      const [noName] = await createTemplate({ name: ' ', nodes: [{ id: 'a', type: 'divider', attrs: {}, slots: {} }] });
      expect(noName.code === 400, 'needs a name');
      expect((await createTemplate({ name: 'x', nodes: [] }))[0].code === 400, 'needs widgets');
      expect((await createTemplate({ name: 'x', nodes: [{ id: 'a', type: 'bogus', attrs: {}, slots: {} }] }))[0].code === 400, 'widgets are checked');
      const saved = ok(await createTemplate({ name: 'Two columns', nodes: [{ id: 'c', type: 'row', attrs: {}, slots: { default: [{ id: 'k', type: 'column', attrs: {}, slots: { default: [{ id: 'b', type: 'button', attrs: { label: 'Go', href: 'javascript:alert(1)' }, slots: {} }] } }] } }] }), 'create');
      expect(saved.nodes[0].slots.default[0].slots.default[0].attrs.href === '', 'cleaned');
      const { templates } = ok(await listTemplates(), 'list');
      expect(templates.some(template => template.id === saved.id), 'listed');
      ok(await deleteTemplate({ id: saved.id }), 'delete');
      expect((await deleteTemplate({ id: saved.id }))[0].code === 404, 'gone');
      pass('');
    } catch(error) {
      fail(error.message);
    } finally {
      await db.delete(sitebuilderTemplate);
    }
  },

  'widgets come from the extensions that are enabled, and a bad declaration is skipped': async ({ pass, fail }) => {
    if(!databaseReachable) return pass('skipped: no database');
    const now = new Date();
    try {
      await db.insert(extension).values([
        { name: 'sb-on', enabled: true, installedAt: now, updatedAt: now, kempo: { page_widgets: [{ key: 'banner', title: 'Banner', tag: 'sb-banner', page_component: '/sb/Banner.js' }, { key: 'broken', title: 'No tag' }] } },
        { name: 'sb-off', enabled: false, installedAt: now, updatedAt: now, kempo: { page_widgets: [{ key: 'hidden', title: 'Hidden', tag: 'sb-hidden', page_component: '/sb/Hidden.js' }] } }
      ]);
      const keys = (await loadExtensionWidgets()).map(widget => widget.key);
      expect(keys.includes('sb-on:banner') && !keys.includes('sb-off:hidden') && !keys.includes('sb-on:broken'), keys.join());
      pass('');
    } catch(error) {
      fail(error.message);
    } finally {
      await db.delete(extension).where(eq(extension.name, 'sb-on'));
      await db.delete(extension).where(eq(extension.name, 'sb-off'));
    }
  }
};
