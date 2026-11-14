import path from 'path';
import { createHash } from 'crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  What counts as an edit of a starter file. A file the admin merely saved (it stamps `updated` into the frontmatter), or
  that was checked out with Windows line endings, is still the default and must be updated. A real change to the body, or
  to a frontmatter setting that means something, is the owner's and must be kept.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { normalize, planStarterFiles, applyStarterFiles, readRecord } = await import(pathToFileURL(path.join(root, 'server/utils/updates/starterFiles.js')).href);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const dirs = [];
const scratch = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kempo-fingerprint-'));
  dirs.push(dir);
  return dir;
};

const write = (file, content) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
};

export const afterAll = () => {
  dirs.forEach(dir => rmSync(dir, { recursive: true, force: true }));
};

const TEMPLATE_V1 = '<!--\n\towner: system\n-->\n<!DOCTYPE html>\n<html><body>\n<location name="scripts" />\n</body></html>\n';
const TEMPLATE_V2 = '<!--\n\towner: system\n-->\n<!DOCTYPE html>\n<html><body>\n<script type="module" src="/kempo/notifications/client.js"></script>\n<location name="scripts" />\n</body></html>\n';

/* A site holding `siteText` where the old version shipped TEMPLATE_V1 and the new one ships TEMPLATE_V2. */
const planFor = (siteText, { record = true, name = 'default.template.html' } = {}) => {
  const base = scratch();
  const oldRoot = path.join(base, 'old');
  const newRoot = path.join(base, 'new');
  const site = path.join(base, 'site');
  write(path.join(oldRoot, 'app-public', name), TEMPLATE_V1);
  write(path.join(newRoot, 'app-public', name), TEMPLATE_V2);
  write(path.join(site, 'public', name), siteText);
  if(record){
    write(path.join(site, '.kempo', 'shipped.json'), JSON.stringify({ version: '1', files: { [`public/${name}`]: createHash('sha256').update(TEMPLATE_V1).digest('hex') } }));
  }
  return { base, oldRoot, newRoot, site, plan: planStarterFiles({ cwd: site, oldRoot, newRoot }) };
};

export default {
  'normalising ignores line endings, whitespace at the ends, and the order and indentation of the frontmatter': async ({ pass }) => {
    const same = normalize(TEMPLATE_V1);
    expect(normalize(TEMPLATE_V1.replace(/\n/g, '\r\n')) === same, 'CRLF');
    expect(normalize(`﻿${TEMPLATE_V1}`) === same, 'a byte order mark');
    expect(normalize(`${TEMPLATE_V1}\n\n  `) === same, 'trailing whitespace');
    expect(normalize(TEMPLATE_V1.replace('\towner: system', '    owner: system')) === same, 'the indentation of a frontmatter line');
    expect(normalize('<!--\n  title: A\n  owner: system\n-->\nbody') === normalize('<!--\n  owner: system\n  title: A\n-->\nbody'), 'the order of the frontmatter');
    pass();
  },

  'normalising ignores the bookkeeping the admin writes and nothing else in the frontmatter': async ({ pass }) => {
    const base = '<!--\n  owner: system\n  title: Home\n-->\n<p>body</p>';
    const stamped = '<!--\n  owner: system\n  title: Home\n  updated: 2026-11-09T03:23:20.294Z\n  created: 2026-01-01T00:00:00.000Z\n  author: Admin\n  name: Home page\n-->\n<p>body</p>';
    expect(normalize(base) === normalize(stamped), 'updated, created, author and name are bookkeeping');
    for(const edit of ['  title: Welcome', '  owner: custom', '  require-login: true', '  locked: true', '  description: New']){
      const changed = `<!--\n  owner: system\n  title: Home\n${edit}\n-->\n<p>body</p>`;
      expect(normalize(base) !== normalize(changed), `"${edit.trim()}" is a real change`);
    }
    expect(normalize(base) !== normalize(base.replace('body', 'other')), 'the body is a real change');
    expect(normalize('<p>a</p>\n<p>b</p>') !== normalize('<p>a</p>\n<p>c</p>'), 'and so is the body of a file with no frontmatter');
    pass();
  },

  'a template the admin saved (only `updated` stamped) is still the default, and an update replaces it': async ({ pass }) => {
    const { plan, newRoot, site, base } = planFor('<!--\n  owner: system\n  updated: 2026-11-09T03:23:20.294Z\n-->\n' + TEMPLATE_V1.split('-->\n')[1]);
    expect(plan.update.join() === 'public/default.template.html' && plan.edited.length === 0, `update ${plan.update} edited ${plan.edited}`);

    applyStarterFiles({ cwd: site, newRoot, version: '2', plan, backupDir: path.join(base, 'backup') });
    expect(readFileSync(path.join(site, 'public', 'default.template.html'), 'utf8').includes('/kempo/notifications/client.js'), 'the site now loads the notification client');
    expect(readFileSync(path.join(base, 'backup', 'public', 'default.template.html'), 'utf8').includes('updated:'), 'and what was there is kept for going back');
    pass();
  },

  'a file with Windows line endings is still the default': async ({ pass }) => {
    const { plan } = planFor(TEMPLATE_V1.replace(/\n/g, '\r\n'));
    expect(plan.update.join() === 'public/default.template.html', `update ${plan.update} edited ${plan.edited}`);
    pass();
  },

  'a real edit of the body is kept, and so is a real change to a frontmatter setting': async ({ pass }) => {
    expect(planFor(TEMPLATE_V1.replace('<html>', '<html lang="fr">')).plan.edited.join() === 'public/default.template.html', 'a body edit');
    expect(planFor(TEMPLATE_V1.replace('owner: system', 'owner: custom')).plan.edited.join() === 'public/default.template.html', 'a frontmatter edit');
    expect(planFor(TEMPLATE_V1.replace('-->', '\trequire-login: true\n-->')).plan.edited.join() === 'public/default.template.html', 'a new setting');
    pass();
  },

  'a site with no record is judged by the version it was on, with the same tolerance': async ({ pass }) => {
    const stamped = TEMPLATE_V1.replace('-->', '\tupdated: 2026-11-09T03:23:20.294Z\n-->').replace(/\n/g, '\r\n');
    expect(planFor(stamped, { record: false }).plan.update.join() === 'public/default.template.html', 'an old site\'s saved template is updated');
    expect(planFor(TEMPLATE_V1.replace('<body>', '<body class="mine">'), { record: false }).plan.edited.length === 1, 'and its edited one is kept');
    pass();
  },

  'a record made before the fingerprint ignored these things (a byte-for-byte hash) is still understood': async ({ pass }) => {
    /* The site's file is exactly the bytes that were recorded, so it is the default whatever the old version's files are now. */
    const base = scratch();
    const oldRoot = path.join(base, 'old');
    const newRoot = path.join(base, 'new');
    const site = path.join(base, 'site');
    const crlf = TEMPLATE_V1.replace(/\n/g, '\r\n');
    write(path.join(oldRoot, 'app-public', 'a.html'), TEMPLATE_V1.replace('system', 'something else'));
    write(path.join(newRoot, 'app-public', 'a.html'), TEMPLATE_V2);
    write(path.join(site, 'public', 'a.html'), crlf);
    write(path.join(site, '.kempo', 'shipped.json'), JSON.stringify({ version: '1', files: { 'public/a.html': createHash('sha256').update(crlf).digest('hex') } }));
    expect(planStarterFiles({ cwd: site, oldRoot, newRoot }).update.join() === 'public/a.html', 'the exact bytes that were recorded are still the default');
    pass();
  },

  'a file that is not text is compared byte for byte': async ({ pass }) => {
    const base = scratch();
    const oldRoot = path.join(base, 'old');
    const newRoot = path.join(base, 'new');
    const site = path.join(base, 'site');
    write(path.join(oldRoot, 'app-public', 'media', 'icon.png'), Buffer.from([1, 2, 3, 4]));
    write(path.join(newRoot, 'app-public', 'media', 'icon.png'), Buffer.from([9, 9, 9, 9]));
    write(path.join(site, 'public', 'media', 'icon.png'), Buffer.from([1, 2, 3, 5]));
    expect(planStarterFiles({ cwd: site, oldRoot, newRoot }).edited.join() === 'public/media/icon.png', 'one changed byte is an edit');
    write(path.join(site, 'public', 'media', 'icon.png'), Buffer.from([1, 2, 3, 4]));
    expect(planStarterFiles({ cwd: site, oldRoot, newRoot }).update.join() === 'public/media/icon.png', 'and identical bytes are the default');
    pass();
  },

  'what an update writes is remembered as the default, whatever stamps the admin adds to it later': async ({ pass }) => {
    const { plan, newRoot, site, base, oldRoot } = planFor(TEMPLATE_V1);
    applyStarterFiles({ cwd: site, newRoot, version: '2', plan, backupDir: path.join(base, 'backup') });
    expect(Object.keys(readRecord(site).files).includes('public/default.template.html'), 'recorded');

    write(path.join(site, 'public', 'default.template.html'), TEMPLATE_V2.replace('-->', '\tupdated: 2026-12-01T00:00:00.000Z\n-->').replace(/\n/g, '\r\n'));
    const next = path.join(base, 'next');
    write(path.join(next, 'app-public', 'default.template.html'), TEMPLATE_V2.replace('<location', '<!-- v3 --><location'));
    const later = planStarterFiles({ cwd: site, oldRoot: newRoot, newRoot: next });
    expect(later.update.join() === 'public/default.template.html', `the next update still replaces it: ${later.update} / ${later.edited}`);
    expect(oldRoot, 'ok');
    pass();
  },
};
