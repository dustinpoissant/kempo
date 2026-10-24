import path from 'path';
import { spawn } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  A site that runs from a Docker volume: the layout (app/, staging/, releases/, state/), switching its code to a new version
  and back, and the image's startup script that does it, run here as a real process with a stand-in for the site. The
  starter-file rules (what an update may replace) are checked here too. Nothing touches Docker or the network.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => import(pathToFileURL(path.join(root, relative)).href);

const layout = await load('server/utils/updates/siteLayout.js');
const { listShipped, planStarterFiles, applyStarterFiles, recordShipped, readRecord } = await load('server/utils/updates/starterFiles.js');

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const dirs = [];
const scratch = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kempo-layout-'));
  dirs.push(dir);
  return dir;
};

const write = (file, text) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};

const read = file => readFileSync(file, 'utf8');

/* A stand-in for the image's seed: a site with a version of kempo in node_modules and a few of the owner's files. */
const makeSeed = (dir, version = '4.8.0') => {
  write(path.join(dir, 'package.json'), JSON.stringify({ name: 'site', dependencies: { kempo: `^${version}` } }));
  write(path.join(dir, 'package-lock.json'), `lock ${version}`);
  write(path.join(dir, 'node_modules', 'kempo', 'package.json'), JSON.stringify({ name: 'kempo', version }));
  write(path.join(dir, 'public', 'index.page.html'), 'home');
  write(path.join(dir, '.env'), 'SECRET=1');
  return dir;
};

/* A new version as `prepareUpdate` leaves it: staged, with its own node_modules. */
const makeStaged = (siteRoot, version) => {
  const staged = layout.stage({ siteRoot, version });
  write(path.join(staged.dir, 'node_modules', 'kempo', 'package.json'), JSON.stringify({ name: 'kempo', version }));
  write(path.join(staged.dir, 'package.json'), JSON.stringify({ name: 'site', dependencies: { kempo: `^${version}` } }));
  write(path.join(staged.dir, 'package-lock.json'), `lock ${version}`);
  return staged;
};

const appVersion = siteRoot => JSON.parse(read(path.join(siteRoot, 'app', 'node_modules', 'kempo', 'package.json'))).version;

/*
  The startup script as the Dockerfile lays it out (the script and the layout module side by side), run with a site that is a
  small script: it records the version it sees and ends with the code in KEMPO_TEST_EXIT.
*/
const opt = scratch();
cpSync(path.join(root, 'docker', 'entrypoint.mjs'), path.join(opt, 'entrypoint.mjs'));
cpSync(path.join(root, 'server', 'utils', 'updates', 'siteLayout.js'), path.join(opt, 'siteLayout.js'));
const siteScript = path.join(opt, 'site.mjs');
write(siteScript, `
import { readFileSync, appendFileSync } from 'fs';
const version = JSON.parse(readFileSync('node_modules/kempo/package.json', 'utf8')).version;
appendFileSync(process.env.KEMPO_TEST_LOG, version + '\\n');
process.exit(Number(process.env.KEMPO_TEST_EXIT || 0));
`);

const runEntrypoint = (siteRoot, seed, { exit = 0 } = {}) => new Promise(resolve => {
  const log = path.join(siteRoot, '..', 'runs.log');
  const child = spawn(process.execPath, [path.join(opt, 'entrypoint.mjs')], {
    env: { ...process.env, KEMPO_SITE_ROOT: siteRoot, KEMPO_SEED: seed, KEMPO_START_COMMAND: JSON.stringify([process.execPath, siteScript]), KEMPO_TEST_LOG: log, KEMPO_TEST_EXIT: String(exit) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  child.on('exit', code => resolve({ code, output, runs: existsSync(log) ? read(log).trim().split('\n') : [] }));
});

const newSite = () => {
  const base = scratch();
  return { siteRoot: path.join(base, 'site'), seed: makeSeed(path.join(base, 'seed')), base };
};

export const afterAll = async () => {
  for(const dir of dirs) rmSync(dir, { recursive: true, force: true });
};

export default {
  'the first start fills the volume from the image, and only the first': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    expect(layout.seedSite({ siteRoot, seed }) === true, 'an empty volume is seeded');
    expect(appVersion(siteRoot) === '4.8.0' && read(path.join(siteRoot, 'app', '.env')) === 'SECRET=1', "the site's code and files are copied");
    write(path.join(siteRoot, 'app', 'public', 'index.page.html'), 'edited by the owner');
    expect(layout.seedSite({ siteRoot, seed }) === false && read(path.join(siteRoot, 'app', 'public', 'index.page.html')) === 'edited by the owner', 'a volume that has a site is never overwritten by the image');
    expect(layout.getCurrent(siteRoot).version === '4.8.0', 'the version is recorded');
    pass();
  },

  'a switch replaces only the code, keeps the old code for going back, and is repeatable': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    layout.seedSite({ siteRoot, seed });
    write(path.join(siteRoot, 'app', 'public', 'mine.page.html'), 'owner page');
    const staged = makeStaged(siteRoot, '4.9.0');
    expect(appVersion(siteRoot) === '4.8.0', 'staging does not touch the running site');

    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.9.0', source: staged.dir });
    expect(layout.readState(siteRoot, 'switch').status === 'requested', 'asking moves nothing');
    expect(appVersion(siteRoot) === '4.8.0', 'still the old code until the startup script runs');

    const done = layout.performSwitch(siteRoot);
    expect(done.status === 'switched' && appVersion(siteRoot) === '4.9.0', 'the code is the new version');
    expect(read(path.join(siteRoot, 'app', 'package-lock.json')) === 'lock 4.9.0', "the manifests come with it, so the site's extension list matches its code");
    expect(read(path.join(siteRoot, 'app', 'public', 'mine.page.html')) === 'owner page', "the owner's files are not moved");
    expect(!existsSync(path.join(siteRoot, 'staging')), 'the staging folder is gone');
    const { previous } = layout.getCurrent(siteRoot);
    expect(previous.version === '4.8.0' && JSON.parse(read(path.join(siteRoot, 'releases', previous.id, 'node_modules', 'kempo', 'package.json'))).version === '4.8.0', 'the old code is kept');
    expect(layout.performSwitch(siteRoot) === null, 'a switch already done is not done again');
    pass();
  },

  'a switch that was cut short in the middle finishes at the next start': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    layout.seedSite({ siteRoot, seed });
    const staged = makeStaged(siteRoot, '4.9.0');
    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.9.0', source: staged.dir });

    /* the first rename happened and the process died before the second */
    const from = layout.getCurrent(siteRoot);
    mkdirSync(path.join(siteRoot, 'releases', from.id), { recursive: true });
    cpSync(path.join(siteRoot, 'app', 'node_modules'), path.join(siteRoot, 'releases', from.id, 'node_modules'), { recursive: true });
    rmSync(path.join(siteRoot, 'app', 'node_modules'), { recursive: true });
    layout.writeState(siteRoot, 'switch', { ...layout.readState(siteRoot, 'switch'), status: 'switching' });

    layout.performSwitch(siteRoot);
    expect(appVersion(siteRoot) === '4.9.0', 'the new code is in place');
    expect(JSON.parse(read(path.join(siteRoot, 'releases', from.id, 'node_modules', 'kempo', 'package.json'))).version === '4.8.0', 'and the old code was not lost or replaced');
    pass();
  },

  'a new version that never stays up is put back, with the starter files it replaced': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    layout.seedSite({ siteRoot, seed });
    const staged = makeStaged(siteRoot, '4.9.0');
    const filesDir = path.join(siteRoot, 'state', 'backups', 'files');
    write(path.join(filesDir, 'public', 'login.html'), 'login as it was');
    write(path.join(siteRoot, 'app', 'public', 'login.html'), 'login from 4.9.0');
    write(path.join(siteRoot, 'app', 'public', 'new.html'), 'a file 4.9.0 added');
    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.9.0', source: staged.dir, filesBackup: { dir: filesDir, files: [{ path: 'public/login.html', existed: true }, { path: 'public/new.html', existed: false }] } });
    layout.performSwitch(siteRoot);

    for(let start = 1; start <= layout.MAX_ATTEMPTS; start++){
      expect(!layout.shouldRollBack(layout.countAttempt(siteRoot)), `start ${start} is still given a chance`);
    }
    expect(layout.shouldRollBack(layout.countAttempt(siteRoot)), 'one start too many puts it back');

    const result = layout.rollBack({ siteRoot, reason: 'it stopped too many times' });
    expect(result.ok && appVersion(siteRoot) === '4.8.0', 'the old code is back');
    expect(read(path.join(siteRoot, 'app', 'public', 'login.html')) === 'login as it was' && !existsSync(path.join(siteRoot, 'app', 'public', 'new.html')), 'files it replaced are restored and files it added are removed');
    const recorded = layout.readState(siteRoot, 'last');
    expect(layout.readState(siteRoot, 'switch') === null && recorded.ok === false && recorded.kind === 'rollback', 'the failure is recorded for the admin to see, as a rollback');
    pass();
  },

  'a version that says it failed is put back at once, and one that stays up becomes final': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    layout.seedSite({ siteRoot, seed });
    const staged = makeStaged(siteRoot, '4.9.0');
    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.9.0', source: staged.dir });
    layout.performSwitch(siteRoot);
    layout.flagFailed({ siteRoot, reason: 'a data migration failed' });
    expect(layout.shouldRollBack(layout.countAttempt(siteRoot)), 'a flagged failure does not wait for more attempts');

    const second = makeStaged(siteRoot, '5.0.0');
    layout.clearState(siteRoot, 'switch');
    layout.requestSwitch({ siteRoot, id: second.id, version: '5.0.0', source: second.dir });
    layout.performSwitch(siteRoot);
    expect(layout.markHealthy(siteRoot) === true && layout.readState(siteRoot, 'switch') === null, 'staying up ends the trial');
    expect(layout.readState(siteRoot, 'last').ok === true && layout.readState(siteRoot, 'last').to === '5.0.0', 'and is recorded');
    const kept = layout.getCurrent(siteRoot).previous;
    expect(existsSync(path.join(siteRoot, 'releases', kept.id)), 'the version before is kept');
    pass();
  },

  'the startup script seeds, runs the site and ends with the site\'s exit code': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    const result = await runEntrypoint(siteRoot, seed, { exit: 75 });
    expect(result.code === 75, `the exit code is passed on so a restart policy sees it: ${result.code}\n${result.output}`);
    expect(result.runs.join() === '4.8.0' && /First start/.test(result.output), 'the site ran from the seeded copy');
    pass();
  },

  'the startup script switches to a staged version before the site runs, and keeps it while it stays up': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    await runEntrypoint(siteRoot, seed);
    const staged = makeStaged(siteRoot, '4.9.0');
    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.9.0', source: staged.dir });

    const result = await runEntrypoint(siteRoot, seed);
    expect(result.runs.join() === '4.8.0,4.9.0', `the site ran the new code: ${result.runs.join()}\n${result.output}`);
    expect(/4\.8\.0 -> 4\.9\.0/.test(result.output), 'and said so');
    expect(layout.readState(siteRoot, 'switch').status === 'switched', 'the switch is on trial');
    pass();
  },

  'the startup script says what was switched to: the packages, not a version that did not change': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    await runEntrypoint(siteRoot, seed);
    const staged = makeStaged(siteRoot, '4.8.0');
    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.8.0', source: staged.dir, packages: ['kempo-payments@0.4.1'] });
    const result = await runEntrypoint(siteRoot, seed);
    expect(/Switched to kempo-payments@0\.4\.1/.test(result.output) && !/4\.8\.0 -> 4\.8\.0/.test(result.output), `an extension-only update names the extension: ${result.output}`);
    pass();
  },

  'the startup script puts the old version back after a new one keeps failing': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    await runEntrypoint(siteRoot, seed);
    const staged = makeStaged(siteRoot, '4.9.0');
    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.9.0', source: staged.dir });

    let result;
    let said = '';
    for(let start = 0; start <= layout.MAX_ATTEMPTS + 1; start++){
      result = await runEntrypoint(siteRoot, seed, { exit: 1 });
      said += result.output;
    }
    expect(/Going back/.test(said), `it went back: ${said}`);
    expect(result.runs.at(-1) === '4.8.0' && appVersion(siteRoot) === '4.8.0', `and ran the old version: ${result.runs.join()}`);
    expect(layout.readState(siteRoot, 'last').ok === false, 'the admin can see what happened');
    pass();
  },

  'the startup script goes back at once when the site flagged its new version as failed': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    await runEntrypoint(siteRoot, seed);
    const staged = makeStaged(siteRoot, '4.9.0');
    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.9.0', source: staged.dir });
    await runEntrypoint(siteRoot, seed, { exit: 1 });
    layout.flagFailed({ siteRoot, reason: 'a data migration failed' });

    const result = await runEntrypoint(siteRoot, seed);
    expect(/data migration failed/.test(result.output) && appVersion(siteRoot) === '4.8.0', `back on the old version after one failed start: ${result.output}`);
    pass();
  },

  'going back by hand restores the starter files and is not undone by itself': async ({ pass }) => {
    const { siteRoot, seed } = newSite();
    layout.seedSite({ siteRoot, seed });
    const staged = makeStaged(siteRoot, '4.9.0');
    layout.requestSwitch({ siteRoot, id: staged.id, version: '4.9.0', source: staged.dir });
    layout.performSwitch(siteRoot);
    layout.markHealthy(siteRoot);

    const { previous } = layout.getCurrent(siteRoot);
    const filesDir = path.join(siteRoot, 'state', 'backups', 'x');
    write(path.join(filesDir, 'public', 'a.html'), 'a as it was');
    write(path.join(siteRoot, 'app', 'public', 'a.html'), 'a updated');
    layout.requestSwitch({ siteRoot, id: previous.id, version: previous.version, source: path.join(siteRoot, 'releases', previous.id), kind: 'rollback', filesBackup: { dir: filesDir, files: [{ path: 'public/a.html', existed: true }] } });
    layout.performSwitch(siteRoot);
    layout.restoreFiles({ siteRoot, backup: layout.readState(siteRoot, 'switch').filesBackup });
    expect(appVersion(siteRoot) === '4.8.0' && read(path.join(siteRoot, 'app', 'public', 'a.html')) === 'a as it was', 'the code and the file are as they were');
    for(let start = 0; start < layout.MAX_ATTEMPTS + 3; start++) layout.countAttempt(siteRoot);
    expect(!layout.shouldRollBack(layout.readState(siteRoot, 'switch')), 'a rollback that fails to stay up is not rolled back again, it would flip between two versions');
    pass();
  },

  'starter files: never-edited files update, edited ones stay, deleted ones stay deleted, new ones are added': async ({ pass }) => {
    const base = scratch();
    const oldRoot = path.join(base, 'old');
    const newRoot = path.join(base, 'new');
    const site = path.join(base, 'site');
    for(const [name, text] of [['same.html', 'same'], ['untouched.html', 'v1'], ['edited.html', 'v1'], ['deleted.html', 'v1'], ['forced.html', 'v1'], ['unchanged-but-edited.html', 'v1']]){
      write(path.join(oldRoot, 'app-public', name), text);
      write(path.join(site, 'public', name), text);
    }
    for(const [name, text] of [['same.html', 'same'], ['untouched.html', 'v2'], ['edited.html', 'v2'], ['deleted.html', 'v2'], ['forced.html', 'v2'], ['unchanged-but-edited.html', 'v1'], ['brand-new.html', 'v2']]){
      write(path.join(newRoot, 'app-public', name), text);
    }
    write(path.join(site, 'public', 'edited.html'), 'owner edit');
    write(path.join(site, 'public', 'forced.html'), 'owner edit of a file that must be replaced');
    write(path.join(site, 'public', 'unchanged-but-edited.html'), 'owner edit of a file kempo did not change');
    rmSync(path.join(site, 'public', 'deleted.html'));
    write(path.join(newRoot, 'package.json'), JSON.stringify({ kempo: { forceUpdate: ['public/forced.html'] } }));

    const plan = planStarterFiles({ cwd: site, oldRoot, newRoot });
    expect(plan.update.join() === 'public/untouched.html', `never edited: ${plan.update}`);
    expect(plan.edited.join() === 'public/edited.html', `edited: ${plan.edited}`);
    expect(plan.forced.join() === 'public/forced.html', `edited but must be replaced: ${plan.forced}`);
    expect(plan.deleted.join() === 'public/deleted.html', `deleted by the owner: ${plan.deleted}`);
    expect(plan.add.join() === 'public/brand-new.html', `new: ${plan.add}`);
    expect(plan.current.includes('public/same.html') && plan.current.includes('public/unchanged-but-edited.html'), 'a file kempo did not change is never a conflict, edited or not');

    const refused = applyStarterFiles({ cwd: site, newRoot, version: '2', plan, backupDir: path.join(base, 'b1') });
    expect(read(path.join(site, 'public', 'untouched.html')) === 'v2' && read(path.join(site, 'public', 'brand-new.html')) === 'v2', 'updated and added');
    expect(read(path.join(site, 'public', 'edited.html')) === 'owner edit' && read(path.join(site, 'public', 'forced.html')) === 'owner edit of a file that must be replaced', "edits stay without the owner's word");
    expect(!existsSync(path.join(site, 'public', 'deleted.html')), 'a deleted file is not brought back');
    expect(refused.files.length === 2 && refused.files.find(file => file.path === 'public/untouched.html').existed === true, 'what was replaced is listed for going back');
    expect(read(path.join(base, 'b1', 'public', 'untouched.html')) === 'v1', 'and kept');

    applyStarterFiles({ cwd: site, newRoot, version: '2', plan: planStarterFiles({ cwd: site, oldRoot, newRoot }), includeForced: true, backupDir: path.join(base, 'b2') });
    expect(read(path.join(site, 'public', 'forced.html')) === 'v2' && read(path.join(base, 'b2', 'public', 'forced.html')) === 'owner edit of a file that must be replaced', 'with confirmation the forced file is replaced, and the owner\'s version is kept');
    expect(readRecord(site).files['public/untouched.html'], 'what is now in the site is remembered');

    const next = planStarterFiles({ cwd: site, oldRoot: newRoot, newRoot });
    expect(next.update.length === 0 && next.edited.length === 0, 'run again, there is nothing left to do');
    pass();
  },

  'a site made before the record existed is judged against the running version, and init records what it copies': async ({ pass }) => {
    const base = scratch();
    const oldRoot = path.join(base, 'old');
    const site = path.join(base, 'site');
    write(path.join(oldRoot, 'app-public', 'a.html'), 'v1');
    write(path.join(site, 'public', 'a.html'), 'v1');
    recordShipped({ cwd: site, packageRoot: oldRoot, version: '1' });
    expect(readRecord(site).files['public/a.html'], 'init records what it copied');
    rmSync(path.join(site, '.kempo', 'shipped.json'));
    expect(Object.keys(readRecord(site).files).length === 0, 'an old site has no record');
    const newRoot = path.join(base, 'new');
    write(path.join(newRoot, 'app-public', 'a.html'), 'v2');
    expect(planStarterFiles({ cwd: site, oldRoot, newRoot }).update.join() === 'public/a.html', 'a file equal to what the running version ships counts as never edited');
    write(path.join(site, 'public', 'a.html'), 'customised');
    expect(planStarterFiles({ cwd: site, oldRoot, newRoot }).edited.join() === 'public/a.html', 'and one that is not counts as edited, so nothing is overwritten by mistake');
    expect(listShipped(newRoot)[0].path === 'public/a.html', 'starter files are listed by where they go in the site');
    pass();
  },
};
