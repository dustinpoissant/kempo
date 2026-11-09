import path from 'path';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';

/*
  The pages that come with kempo are made of widgets: each page file in app-public is what its tree in systemPages.js renders
  to, a page that has not been changed opens in the page builder as those widgets (and not as one block of code), and a page
  someone has changed is left as it is.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));
const appPublic = path.join(root, 'app-public');

const db = (await load('server/db/index.js')).default;
const { sitebuilderPage } = await load('server/db/schema.js');
const openPage = (await load('server/utils/sitebuilder/openPage.js')).default;
const { default: loadRegistry } = await load('server/utils/sitebuilder/registry.js');
const { readPage, listLocations, treesMatchFile, renderTrees, blockContent } = await load('server/utils/sitebuilder/pageCore.js');
const systemPages = (await load('src/kempo/pagebuilder/systemPages.js')).default;

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const types = nodes => nodes.flatMap(node => [node.type, ...Object.values(node.slots || {}).flatMap(types)]);

export default {
  'every page that comes with kempo has a tree, and its file is what the tree renders to': async ({ pass, fail }) => {
    try {
      const registry = await loadRegistry();
      for(const [file, trees] of Object.entries(systemPages)){
        const [error, page] = await readPage({ rootDir: appPublic, file });
        expect(!error, `${file}: ${error?.msg}`);
        const locations = await listLocations({ rootDir: appPublic, parsed: page.parsed });
        const rendered = renderTrees(trees, locations, registry);
        expect(treesMatchFile({ parsed: page.parsed, trees: { ...trees, ...Object.fromEntries(locations.filter(l => !l.code && !trees[l.name]).map(l => [l.name, [{ id: 'x', type: 'html', attrs: { html: blockContent(page.parsed, l.name) }, slots: {} }]])) }, locations, registry }), `${file} is not what its tree renders to (run npm run build:pages): ${JSON.stringify(rendered).slice(0, 160)}`);
      }
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'a page that comes with kempo opens in the builder as its widgets, not as one block of code': async ({ pass, fail }) => {
    try {
      await db.delete(sitebuilderPage);
      for(const [file, trees] of Object.entries(systemPages)){
        const [error, opened] = await openPage({ rootDir: appPublic, file });
        expect(!error, `${file}: ${error?.msg}`);
        expect(opened.state === 'builder', `${file} opened as ${opened.state}`);
        const shown = types(opened.trees.default);
        expect(!shown.includes('html'), `${file} has an HTML widget in it`);
        expect(JSON.stringify(types(trees.default)) === JSON.stringify(shown), `${file} opened as ${shown.join()}`);
      }
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'a page that has been changed since is taken as it is, and what is in the builder is not replaced': async ({ pass, fail }) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'kempo-system-pages-'));
    try {
      await cp(path.join(appPublic, 'default.template.html'), path.join(dir, 'default.template.html'));
      await mkdir(path.join(dir, 'login'));
      const original = await readFile(path.join(appPublic, 'login/index.page.html'), 'utf8');
      await writeFile(path.join(dir, 'login/index.page.html'), original.replace('<k-login class="d-b">', '<h2>Our own heading</h2><k-login class="d-b">'));
      await db.delete(sitebuilderPage);
      const [error, opened] = await openPage({ rootDir: dir, file: 'login/index.page.html' });
      expect(!error && opened.state === 'builder', `opened as ${opened?.state}`);
      expect(types(opened.trees.default).join() === 'html', `a changed page opened as ${types(opened.trees.default).join()}`);
      expect(opened.trees.default[0].attrs.html.includes('Our own heading'), 'what the person wrote was lost');
      pass('');
    } catch(error) {
      fail(error.message);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await db.delete(sitebuilderPage).where(eq(sitebuilderPage.file, 'login/index.page.html'));
    }
  },

  'a page that comes with kempo is not given widgets again once the builder has its own copy': async ({ pass, fail }) => {
    try {
      await db.delete(sitebuilderPage);
      const [, first] = await openPage({ rootDir: appPublic, file: 'login/index.page.html' });
      expect(types(first.trees.default).includes('login'), 'the first open was not its widgets');
      const [, row] = [null, (await db.select().from(sitebuilderPage).where(eq(sitebuilderPage.file, 'login/index.page.html')))[0]];
      expect(row && !row.codeOnly, 'the builder did not keep a row for it');
      const [, again] = await openPage({ rootDir: appPublic, file: 'login/index.page.html' });
      expect(JSON.stringify(again.trees) === JSON.stringify(first.trees), 'the second open differs from the first');
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'a page that was opened before it had widgets, and only holds the file as one HTML widget, gets its widgets': async ({ pass, fail }) => {
    try {
      const { saveRow } = await load('server/utils/sitebuilder/rows.js');
      const [, page] = await readPage({ rootDir: appPublic, file: 'login/index.page.html' });
      await db.delete(sitebuilderPage);
      const registry = await loadRegistry();
      const locations = await listLocations({ rootDir: appPublic, parsed: page.parsed });
      const { adoptFile } = await load('server/utils/sitebuilder/pageCore.js');
      await saveRow({ file: 'login/index.page.html', trees: adoptFile({ parsed: page.parsed, locations, registry }).trees, fileHash: page.hash, codeOnly: false, savedBy: null });
      const [, opened] = await openPage({ rootDir: appPublic, file: 'login/index.page.html' });
      expect(opened.state === 'builder' && types(opened.trees.default).includes('login'), `opened as ${opened.state}: ${types(opened.trees.default).join()}`);
      /* but a page that has been worked on in the builder (here a text widget instead) keeps its widgets */
      await db.delete(sitebuilderPage);
      await saveRow({ file: 'login/index.page.html', trees: { default: [{ id: 'mine', type: 'text', attrs: { html: '<p>x</p>' }, slots: {} }] }, fileHash: page.hash, codeOnly: false, savedBy: null });
      const [, kept] = await openPage({ rootDir: appPublic, file: 'login/index.page.html' });
      expect(types(kept.trees.default).join() === 'text' || kept.state === 'conflict', `a worked-on page was replaced: ${kept.state} ${types(kept.trees.default).join()}`);
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'the pre-rendered link pages the server serves first are the widgets too, with no script of their own': async ({ pass, fail }) => {
    try {
      for(const [folder, tag] of [['reset-password/[token]', 'k-reset-password'], ['verify-email/[token]', 'k-verify-email']]){
        const source = await readFile(path.join(appPublic, folder, 'index.html'), 'utf8');
        expect(source.includes(`<${tag}`), `${folder}/index.html does not use ${tag} (run npm run build:pages)`);
        expect(!/<form|getElementById|<script>|<script type="module">\s*\r?\n?\s*import/.test(source), `${folder}/index.html still has form or script code of its own`);
        expect((source.match(/<main\b/g) ?? []).length === 1, `${folder}/index.html has more than one main`);
      }
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'the pages hold no form code of their own, and their elements are the widgets': async ({ pass, fail }) => {
    try {
      const widgetTags = new Set((await load('src/kempo/pagebuilder/coreWidgets.js')).default.map(widget => widget.tag));
      for(const file of ['login', 'register', 'forgot-password', 'reset-password/[token]', 'verify-email/[token]', 'delete-account', 'account']){
        const source = await readFile(path.join(appPublic, file, 'index.page.html'), 'utf8');
        expect(!/<form|getElementById|<script>/.test(source.replace(/<script type="module" src="[^"]+"><\/script>/g, '')), `${file} has script or form code of its own`);
        const used = [...source.matchAll(/<(k-[a-z-]+)/g)].map(match => match[1]);
        expect(used.length > 0 && used.every(tag => widgetTags.has(tag) || tag === 'k-notification-bell'), `${file} uses elements that are not widgets: ${used.filter(tag => !widgetTags.has(tag)).join()}`);
      }
      pass('');
    } catch(error) {
      fail(error.message);
    }
  }
};
