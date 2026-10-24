import path from 'path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { gunzipSync } from 'zlib';
import { fileURLToPath, pathToFileURL } from 'url';
import { inArray } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  Updating a site that runs from a Docker volume: preparing a new version next to the running one and working out what
  switching to it would change, switching (with the owner's confirmation where it is needed, and a database backup first
  when data changes), going back, and kempo's own data migrations. The registry, npm, pg_dump and the restart are stood in.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => import(pathToFileURL(path.join(root, relative)).href);

const db = (await load('server/db/index.js')).default;
const { upgrade } = await load('server/db/schema.js');
const layout = await load('server/utils/updates/siteLayout.js');
const prepareUpdate = (await load('server/utils/updates/prepareUpdate.js')).default;
const applyStagedUpdate = (await load('server/utils/updates/applyStagedUpdate.js')).default;
const rollbackUpdate = (await load('server/utils/updates/rollbackUpdate.js')).default;
const discardUpdate = (await load('server/utils/updates/discardUpdate.js')).default;
const backupDatabase = (await load('server/utils/updates/backupDatabase.js')).default;
const getReleaseStatus = (await load('server/utils/updates/releaseStatus.js')).default;
const runUpgrades = (await load('server/utils/setup/runUpgrades.js')).default;
const { pendingUpgrades } = await load('server/utils/setup/runUpgrades.js');
const { RUNNING_VERSION } = await load('server/utils/updates/runtime.js');

const databaseReachable = await reachable(db);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const [major, minor] = RUNNING_VERSION.split('.').map(Number);
const NEXT = `${major}.${minor + 1}.0`;

const dirs = [];
const scratch = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kempo-release-'));
  dirs.push(dir);
  return dir;
};

const write = (file, text) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};

const read = file => readFileSync(file, 'utf8');

const registry = (version, peerDependencies = {}) => async () => ({ ok: true, status: 200, json: async () => ({ version, peerDependencies }) });

const install = { canUpdate: true, reason: null };

/* A volume with a site on it, and the kempo package the running version ships (its starter files). */
const makeSite = () => {
  const base = scratch();
  const seed = path.join(base, 'seed');
  write(path.join(seed, 'package.json'), '{"name":"site"}');
  write(path.join(seed, 'package-lock.json'), 'lock');
  write(path.join(seed, 'node_modules', 'kempo', 'package.json'), JSON.stringify({ version: RUNNING_VERSION }));
  write(path.join(seed, 'public', 'login.html'), 'login v1');
  write(path.join(seed, 'public', 'mine.html'), 'mine');
  const siteRoot = path.join(base, 'site');
  layout.seedSite({ siteRoot, seed });

  const oldRoot = path.join(base, 'old-kempo');
  write(path.join(oldRoot, 'app-public', 'login.html'), 'login v1');
  return { base, siteRoot, cwd: path.join(siteRoot, 'app'), oldRoot };
};

/* Stands in for npm: the staged copy gets the new kempo, with the starter files and migrations it ships. */
const fakeNpm = ({ login = 'login v2', added = 'brand new', upgrades = {}, forceUpdate } = {}) => async (targets, dir) => {
  const kempo = path.join(dir, 'node_modules', 'kempo');
  write(path.join(kempo, 'package.json'), JSON.stringify({ version: targets[0].split('@')[1], kempo: forceUpdate ? { forceUpdate } : {} }));
  write(path.join(kempo, 'app-public', 'login.html'), login);
  write(path.join(kempo, 'app-public', 'added.html'), added);
  for(const [name, source] of Object.entries(upgrades)) write(path.join(kempo, 'server', 'db', 'upgrades', name), source);
};

const breakingMigration = `
export const meta = { description: 'Moves data', breaking: true };
export const up = async () => {};
`;

const ids = [];

const purge = async () => {
  await db.delete(upgrade).where(inArray(upgrade.id, ['baseline', ...ids])).catch(() => {});
};

export const afterAll = async () => {
  for(const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if(databaseReachable) await purge();
};

const buildTests = () => ({
  'preparing installs next to the running site and says what switching would change': async ({ pass }) => {
    await runUpgrades({ dir: scratch() });
    const { siteRoot, cwd, oldRoot } = makeSite();
    write(path.join(cwd, 'public', 'login.html'), 'login v1');
    const installs = [];
    const run = async (targets, dir) => { installs.push({ targets, dir }); return fakeNpm({ upgrades: { '9.0.0-test.js': breakingMigration } })(targets, dir); };

    const [error, result] = await prepareUpdate({ siteRoot, cwd, oldRoot, install, run, fetcher: registry(NEXT, { 'kempo-ui': '>=0.6.0' }) });
    expect(!error, `prepare failed: ${JSON.stringify(error)}`);
    expect(installs[0].dir.startsWith(path.join(siteRoot, 'staging')) && installs[0].targets[0] === `kempo@${NEXT}`, 'npm ran in the staging folder');
    expect(JSON.parse(read(path.join(cwd, 'node_modules', 'kempo', 'package.json'))).version === RUNNING_VERSION, 'the running code is untouched');
    expect(result.plan.files.update.join() === 'public/login.html' && result.plan.files.add.join() === 'public/added.html', `starter files: ${JSON.stringify(result.plan.files)}`);
    expect(result.plan.breaking && result.plan.upgrades[0].id === '9.0.0-test.js', 'the data migration it carries is listed, and is breaking');

    const status = getReleaseStatus(siteRoot);
    expect(status.mode === 'release' && status.staged.version === NEXT && status.staged.plan.breaking, 'the status shows the staged version and its plan');
    pass();
  },

  'an update that must replace edited files, or change data, waits for the owner to confirm': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    write(path.join(cwd, 'public', 'login.html'), 'login edited by the owner');
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm({ upgrades: { '9.0.1-test.js': breakingMigration }, forceUpdate: ['public/login.html'] }), fetcher: registry(NEXT) });
    const restarts = [];
    const backups = [];
    const options = { siteRoot, cwd, restart: () => restarts.push(1), backup: async ({ file }) => { backups.push(file); write(file, 'dump'); return [null, { file }]; } };

    const [forced] = await applyStagedUpdate(options);
    expect(forced?.code === 409 && forced.details.confirm === 'forced' && forced.details.files.join() === 'public/login.html', `it asks before replacing an edited file: ${JSON.stringify(forced)}`);
    const [breaking] = await applyStagedUpdate({ ...options, confirm: { forced: true } });
    expect(breaking?.code === 409 && breaking.details.confirm === 'breaking' && breaking.details.upgrades[0].id === '9.0.1-test.js', 'and before changing data');
    expect(restarts.length === 0 && backups.length === 0 && !layout.readState(siteRoot, 'switch'), 'nothing happened meanwhile');
    expect(read(path.join(cwd, 'public', 'login.html')) === 'login edited by the owner', "and the owner's file is as it was");

    const [error, result] = await applyStagedUpdate({ ...options, confirm: { forced: true, breaking: true } });
    expect(!error && result.to === NEXT && result.breaking, `confirmed: ${JSON.stringify(error)}`);
    expect(backups.length === 1 && existsSync(backups[0]), 'the database was backed up first');
    expect(read(path.join(cwd, 'public', 'login.html')) === 'login v2', 'the file was replaced');
    const sw = layout.readState(siteRoot, 'switch');
    expect(sw.status === 'requested' && sw.kind === 'update' && sw.breaking && sw.dbBackup === backups[0] && existsSync(path.join(sw.filesBackup.dir, 'public', 'login.html')), 'the switch is asked for, with the way back recorded');
    expect(read(path.join(sw.filesBackup.dir, 'public', 'login.html')) === 'login edited by the owner', "and the owner's version is kept");
    expect(restarts.length === 1, 'the restart is scheduled');
    const [again] = await applyStagedUpdate(options);
    expect(again?.code === 409, 'a second click does nothing');
    pass();
  },

  'a failed backup stops a data-changing update before anything is changed': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm({ upgrades: { '9.0.2-test.js': breakingMigration } }), fetcher: registry(NEXT) });
    const restarts = [];
    const [error] = await applyStagedUpdate({ siteRoot, cwd, confirm: { breaking: true }, restart: () => restarts.push(1), backup: async () => [{ code: 501, msg: 'pg_dump is not installed' }, null] });
    expect(error?.code === 501 && restarts.length === 0, 'refused, with the reason');
    expect(!layout.readState(siteRoot, 'switch') && !existsSync(path.join(cwd, 'public', 'added.html')), 'no switch was requested and no file was added');
    expect(layout.readState(siteRoot, 'staged'), 'the prepared update is still there to try again');
    pass();
  },

  'an update that only adds goes through with no questions, and edited files stay as they are': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    write(path.join(cwd, 'public', 'login.html'), 'login edited by the owner');
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm(), fetcher: registry(NEXT) });
    const restarts = [];
    const [error, result] = await applyStagedUpdate({ siteRoot, cwd, restart: () => restarts.push(1) });
    expect(!error && !result.breaking && restarts.length === 1, `no confirmation needed: ${JSON.stringify(error)}`);
    expect(read(path.join(cwd, 'public', 'login.html')) === 'login edited by the owner' && read(path.join(cwd, 'public', 'added.html')) === 'brand new', 'the edit stayed, the new file arrived');
    pass();
  },

  'a prepared update can be thrown away, and failures leave nothing behind': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    const [failed] = await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: async () => { throw Object.assign(new Error('x'), { stderr: 'npm ERR! network' }); }, fetcher: registry(NEXT) });
    expect(failed?.code === 500 && /network/.test(failed.msg) && !existsSync(path.join(siteRoot, 'staging')), 'a failed download leaves no staging folder');
    const [same] = await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm(), fetcher: registry(RUNNING_VERSION) });
    expect(same?.code === 409, 'the running version is not prepared again');
    const [linked] = await prepareUpdate({ siteRoot, cwd, oldRoot, install: { canUpdate: false, reason: 'linked' }, run: fakeNpm(), fetcher: registry(NEXT) });
    expect(linked?.code === 409, 'a site that cannot be updated is refused');
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm(), fetcher: registry(NEXT) });
    expect(existsSync(path.join(siteRoot, 'staging')), 'a good one is staged');
    discardUpdate({ siteRoot });
    expect(!existsSync(path.join(siteRoot, 'staging')) && getReleaseStatus(siteRoot).staged === null, 'and discarding frees it');
    const [none] = await applyStagedUpdate({ siteRoot, cwd, restart: () => {} });
    expect(none?.code === 409, 'with nothing prepared there is nothing to switch to');
    pass();
  },

  'going back restores the earlier version, and the database only when the update changed data': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm({ upgrades: { '9.0.3-test.js': breakingMigration } }), fetcher: registry(NEXT) });
    let dump;
    await applyStagedUpdate({ siteRoot, cwd, confirm: { breaking: true }, restart: () => {}, backup: async ({ file }) => { dump = file; write(file, 'dump'); return [null, { file }]; } });
    layout.performSwitch(siteRoot);
    layout.markHealthy(siteRoot);
    expect(getReleaseStatus(siteRoot).canGoBack === true && getReleaseStatus(siteRoot).lastUpdate.ok, 'the status offers going back');

    const [asked] = await rollbackUpdate({ siteRoot, restart: () => {} });
    expect(asked?.code === 409 && asked.details.confirm === 'data', 'going back past a data change asks first: it loses what was entered since');
    const restarts = [];
    const [error, result] = await rollbackUpdate({ siteRoot, confirm: { data: true }, restart: () => restarts.push(1) });
    expect(!error && result.to === RUNNING_VERSION && result.restoresData && restarts.length === 1, `going back: ${JSON.stringify(error)}`);
    const sw = layout.readState(siteRoot, 'switch');
    expect(sw.kind === 'rollback' && sw.dbBackup === dump, 'the switch carries the backup to restore');
    layout.performSwitch(siteRoot);
    expect(JSON.parse(read(path.join(cwd, 'node_modules', 'kempo', 'package.json'))).version === RUNNING_VERSION, 'the earlier code is back');
    pass();
  },

  'going back past an update that only added needs no confirmation and keeps the data': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm(), fetcher: registry(NEXT) });
    await applyStagedUpdate({ siteRoot, cwd, restart: () => {} });
    layout.performSwitch(siteRoot);
    layout.markHealthy(siteRoot);
    const [error, result] = await rollbackUpdate({ siteRoot, restart: () => {} });
    expect(!error && result.restoresData === false, 'no database restore');
    expect(layout.readState(siteRoot, 'switch').dbBackup === null, 'and none is asked of the startup script');
    const [nothing] = await rollbackUpdate({ siteRoot, restart: () => {} });
    expect(nothing?.code === 409, 'a second go-back while the first is waiting does nothing');
    pass();
  },

  'a download made from code that has since changed is refused and thrown away, not switched to': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm(), fetcher: registry(NEXT) });
    expect(layout.readState(siteRoot, 'staged'), 'a download is waiting');

    /* an extension installed from the admin after the download: the manifests the download was copied from no longer match */
    write(path.join(cwd, 'package.json'), '{"name":"site","dependencies":{"some-extension":"1.0.0"}}');
    const restarts = [];
    const [error] = await applyStagedUpdate({ siteRoot, cwd, restart: () => restarts.push(1) });
    expect(error?.code === 409 && /changed after this update was downloaded/.test(error.msg) && /get the update ready again/.test(error.msg), `refused, with the way forward: ${JSON.stringify(error)}`);
    expect(restarts.length === 0 && !layout.readState(siteRoot, 'switch'), 'nothing was switched or restarted');
    expect(!layout.readState(siteRoot, 'staged') && !existsSync(path.join(siteRoot, 'staging')), 'the stale copy is gone, so the screen offers the update again');
    expect(read(path.join(cwd, 'package.json')).includes('some-extension'), 'and the change that would have been undone is still there');
    pass();
  },

  'a switch is refused with a plain reason while the last one is still being checked, then allowed': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm(), fetcher: registry(NEXT) });
    layout.writeState(siteRoot, 'switch', { status: 'switched', kind: 'update', attempts: 1, from: { id: 'x', version: '1.0.0' } });
    const [error] = await applyStagedUpdate({ siteRoot, cwd, restart: () => {} });
    expect(error?.code === 409 && /still being checked/.test(error.msg) && /about a minute/.test(error.msg), `says what is happening and for how long: ${error?.msg}`);
    expect(getReleaseStatus(siteRoot).switching === 'switched', 'and the screen is told, so it can disable the button');
    layout.clearState(siteRoot, 'switch');
    const [ok] = await applyStagedUpdate({ siteRoot, cwd, restart: () => {} });
    expect(!ok, 'once the trial is over the same download switches');
    pass();
  },

  'the screen and the server agree on what Go back does: not on trial, not after a rollback, and the data warning only when data would be restored': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    expect(getReleaseStatus(siteRoot).goBack.available === false && /no earlier version/.test(getReleaseStatus(siteRoot).goBack.reason), 'nothing to go back to at first');

    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm({ upgrades: { '9.1.0-test.js': breakingMigration } }), fetcher: registry(NEXT) });
    await applyStagedUpdate({ siteRoot, cwd, confirm: { breaking: true }, restart: () => {}, backup: async ({ file }) => { write(file, 'dump'); return [null, { file }]; } });
    layout.performSwitch(siteRoot);

    const onTrial = getReleaseStatus(siteRoot);
    expect(onTrial.switching === 'switched' && onTrial.goBack.available === false && /still being checked/.test(onTrial.goBack.reason), 'not offered while the new version is still proving itself');
    const [early] = await rollbackUpdate({ siteRoot, restart: () => {} });
    expect(early?.code === 409 && early.msg === onTrial.goBack.reason, 'and the server refuses with the same words');

    layout.markHealthy(siteRoot);
    const settled = getReleaseStatus(siteRoot);
    expect(settled.goBack.available === true && settled.goBack.restoresData === true, 'once it has settled, going back is offered and the screen says it restores the database');

    const [, plain] = [null, await rollbackUpdate({ siteRoot, confirm: { data: true }, restart: () => {} })];
    expect(!plain[0] && plain[1].restoresData === true, 'the server restores the database, which is what the screen said');
    layout.performSwitch(siteRoot);
    layout.markHealthy(siteRoot);

    const afterRollback = getReleaseStatus(siteRoot);
    expect(afterRollback.goBack.available === false && /just gone back/.test(afterRollback.goBack.reason), 'straight after a rollback it is not offered: the earlier version is the one just left');
    const [again] = await rollbackUpdate({ siteRoot, restart: () => {} });
    expect(again?.code === 409 && again.msg === afterRollback.goBack.reason, 'and the server refuses with the same words');
    pass();
  },

  'after the site put itself back, Go back is not offered, including for a record an older startup script wrote': async ({ pass }) => {
    const { siteRoot, cwd, oldRoot } = makeSite();
    await prepareUpdate({ siteRoot, cwd, oldRoot, install, run: fakeNpm(), fetcher: registry(NEXT) });
    await applyStagedUpdate({ siteRoot, cwd, restart: () => {} });
    layout.performSwitch(siteRoot);
    layout.flagFailed({ siteRoot, reason: 'an update script failed' });
    layout.rollBack({ siteRoot, reason: 'an update script failed' });
    const last = layout.readState(siteRoot, 'last');
    expect(last.ok === false && last.kind === 'rollback', 'the record says what happened');
    expect(getReleaseStatus(siteRoot).goBack.available === false, 'so the screen does not offer to go back past a rollback');

    /* what an earlier startup script wrote: no `kind` at all */
    layout.writeState(siteRoot, 'last', { ok: false, from: NEXT, to: RUNNING_VERSION, reason: 'old record', at: new Date().toISOString() });
    expect(getReleaseStatus(siteRoot).goBack.available === false, 'and the same for a record that has only ok: false');
    pass();
  },

  'a site with no earlier version has nothing to go back to': async ({ pass }) => {
    const { siteRoot } = makeSite();
    const [error] = await rollbackUpdate({ siteRoot, restart: () => {} });
    expect(error?.code === 409 && getReleaseStatus(siteRoot).canGoBack === false, 'refused');
    expect(getReleaseStatus(undefined).mode === 'in-place', 'a site that is not on a volume reports in-place updating');
    pass();
  },

  'data migrations: a baseline first, then each new file once, and a failure changes nothing': async ({ pass }) => {
    await purge();
    const dir = scratch();
    write(path.join(dir, '1.0.0-already-there.js'), 'export const meta = { breaking: true }; export const up = async () => { throw new Error("must not run: it came with the baseline"); };');

    const [baselineError, baseline] = await runUpgrades({ dir });
    expect(!baselineError && baseline.ran.length === 0, 'a database that had none takes what is shipped as already done');
    expect((await pendingUpgrades({ dir })).length === 0, 'so nothing is pending');

    ids.push('2.0.0-adds-row.js', '2.0.1-fails.js', '2.0.2-never-reached.js');
    write(path.join(dir, '2.0.0-adds-row.js'), 'export const meta = { description: "A step", breaking: false }; export const up = async ({ db, sql }) => { await db.execute(sql`select 1`); };');
    write(path.join(dir, '2.0.1-fails.js'), 'export const meta = { breaking: true }; export const up = async ({ db, sql }) => { await db.execute(sql`select 1`); throw new Error("it broke"); };');
    write(path.join(dir, '2.0.2-never-reached.js'), 'export const meta = {}; export const up = async () => { throw new Error("must not run after a failure"); };');

    const pending = await pendingUpgrades({ dir });
    expect(pending.map(item => item.id).join() === '2.0.0-adds-row.js,2.0.1-fails.js,2.0.2-never-reached.js' && pending[1].breaking && !pending[0].breaking, `looking ahead lists them in order with their kind: ${JSON.stringify(pending)}`);

    const [error, result] = await runUpgrades({ dir });
    expect(error?.breaking === true && error.id === '2.0.1-fails.js' && /it broke/.test(error.msg), `a breaking failure is reported as one: ${JSON.stringify(error)}`);
    expect(result.ran.join() === '2.0.0-adds-row.js', 'the one before it ran and stays recorded, the ones after it did not');
    expect((await pendingUpgrades({ dir })).map(item => item.id).join() === '2.0.1-fails.js,2.0.2-never-reached.js', 'the failed one, and the one after it, are still pending');
    pass();
  },

  'a backup is gzipped SQL, and a missing pg_dump or a failed dump is an error, not a silent empty file': async ({ pass }) => {
    const dir = scratch();
    const fake = ({ out = '', code = 0, error }) => (command, args) => {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.args = [command, ...args];
      setImmediate(() => {
        if(error){
          child.stdout.end();
          child.emit('error', Object.assign(new Error('spawn pg_dump ENOENT'), { code: 'ENOENT' }));
          return;
        }
        child.stdout.end(out);
        setImmediate(() => child.emit('exit', code));
      });
      return child;
    };

    const file = path.join(dir, 'b', 'dump.sql.gz');
    let seen;
    const [ok] = await backupDatabase({ file, url: 'postgres://u:p@h/db', spawner: (...args) => { seen = args; return fake({ out: 'CREATE TABLE t();' })(...args); } });
    expect(!ok && gunzipSync(readFileSync(file)).toString() === 'CREATE TABLE t();', 'the dump is written gzipped');
    expect(seen[0] === 'pg_dump' && seen[1].includes('--clean') && seen[1].includes('--if-exists') && seen[1].at(-1) === 'postgres://u:p@h/db', 'and restores itself: it drops what it replaces');

    const [missing] = await backupDatabase({ file: path.join(dir, 'm.gz'), url: 'x', spawner: fake({ error: true }) });
    expect(missing?.code === 501, 'no pg_dump is a clear refusal');
    const [failed] = await backupDatabase({ file: path.join(dir, 'f.gz'), url: 'x', spawner: fake({ out: 'partial', code: 1 }) });
    expect(failed?.code === 500, 'a dump that ended badly is an error');
    const [noUrl] = await backupDatabase({ file: path.join(dir, 'n.gz'), url: '' });
    expect(noUrl?.code === 500, 'and so is having no database to back up');
    pass();
  },
});

export default databaseReachable
  ? buildTests()
  : { 'release updates (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
