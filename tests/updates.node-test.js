import path from 'path';
import { spawn } from 'child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'fs/promises';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray } from 'drizzle-orm';
import { reachable, seedDatabase } from './helpers/db.js';

/*
  Updating kempo from the admin portal: reading the newest version from npm, deciding whether this site can
  install it, installing it with the peers it needs, telling the people who can, and restarting the server.
  Nothing here reaches npm or stops a real server: the registry, the install and the exit are stood in for.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, userGroup, session, notification } = await load('server/db/schema.js');
const { createUser, addUserToGroup } = await load('server/sdk.js');
const setSetting = (await load('server/utils/settings/setSetting.js')).default;
const { compareVersions, isVersion, lowerBound } = await load('server/utils/updates/helpers.js');
const { RUNNING_VERSION } = await load('server/utils/updates/runtime.js');
const { restartMode, restartServer, scheduleRestart, RESTART_EXIT_CODE } = await load('server/utils/updates/restart.js');
const getInstallInfo = (await load('server/utils/updates/getInstallInfo.js')).default;
const fetchManifest = (await load('server/utils/updates/fetchManifest.js')).default;
const getUpdateStatus = (await load('server/utils/updates/getUpdateStatus.js')).default;
const { resetUpdateStatus } = await load('server/utils/updates/getUpdateStatus.js');
const applyUpdate = (await load('server/utils/updates/applyUpdate.js')).default;
const runUpdateCheck = (await load('server/utils/updates/runUpdateCheck.js')).default;

const databaseReachable = await reachable(db);

/* An update time that is recent, so the hourly cleanup of old notifications does not delete the row it is set on. */
const MARKER = new Date(Date.now() - 60000);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const [major, minor] = RUNNING_VERSION.split('.').map(Number);
const NEXT_MINOR = `${major}.${minor + 1}.0`;
const NEXT_MAJOR = `${major + 1}.0.0`;

const registry = (version, peerDependencies = {}) => async () => ({
  ok: true,
  status: 200,
  json: async () => ({ version, peerDependencies })
});

const ADMIN_EMAIL = 'updates-test-admin@test.local';
const state = { site: null, adminId: null };

const writeJson = (file, data) => writeFile(file, JSON.stringify(data));

const makeSite = async () => {
  const site = await mkdtemp(path.join(tmpdir(), 'kempo-updates-'));
  await mkdir(path.join(site, 'node_modules', 'kempo'), { recursive: true });
  await mkdir(path.join(site, 'node_modules', 'kempo-server'), { recursive: true });
  await writeJson(path.join(site, 'package.json'), { dependencies: { kempo: `^${RUNNING_VERSION}` } });
  await writeJson(path.join(site, 'node_modules', 'kempo', 'package.json'), { version: RUNNING_VERSION });
  await writeJson(path.join(site, 'node_modules', 'kempo-server', 'package.json'), { version: '3.0.0' });
  return site;
};

/* Stands in for npm: records what it was asked to install and puts those versions on disk. */
const fakeNpm = (site, installed) => async (targets, cwd) => {
  installed.push({ targets, cwd });
  const version = targets[0].split('@')[1];
  await writeJson(path.join(site, 'node_modules', 'kempo', 'package.json'), { version });
  if(targets.includes('kempo-server@latest')) await writeJson(path.join(site, 'node_modules', 'kempo-server', 'package.json'), { version: '3.9.0' });
};

const purge = async () => {
  await db.delete(notification).where(eq(notification.owner, 'kempo')).catch(() => {});
  const [row] = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL));
  if(row){
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
};

const waitFor = async (file, ms) => {
  for(let waited = 0; waited < ms; waited += 100){
    if(await access(file).then(() => true, () => false)) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
};

const buildTests = () => ({
  'versions are compared as numbers, and only plain releases are accepted': async ({ pass }) => {
    expect(compareVersions('4.10.0', '4.9.0') === 1, '4.10.0 should be newer than 4.9.0');
    expect(compareVersions('4.8.0', '4.8.0') === 0, 'equal versions');
    expect(compareVersions('3.99.99', '4.0.0') === -1, '3.99.99 should be older than 4.0.0');
    expect(isVersion('4.8.0') && !isVersion('4.8.0-beta.1') && !isVersion('latest') && !isVersion('4.8') && !isVersion('4.8.0 && calc') && !isVersion(null), 'only x.y.z is a version');
    expect(lowerBound('>=3.4.0') === '3.4.0' && lowerBound('^2.2.5') === '2.2.5' && lowerBound('*') === null, 'the lowest version a peer range allows');
    pass();
  },

  'a linked or source checkout is not updated, an npm install is': async ({ pass }) => {
    state.site = await makeSite();
    const inside = path.join(state.site, 'node_modules', 'kempo');
    expect(getInstallInfo({ cwd: state.site, packageRoot: inside }).canUpdate === true, 'a package installed from npm can be updated');
    const linked = getInstallInfo({ cwd: state.site, packageRoot: path.join(tmpdir(), 'somewhere-else', 'kempo') });
    expect(linked.canUpdate === false && /linked/.test(linked.reason), `a checkout outside node_modules must be refused: ${JSON.stringify(linked)}`);
    await writeJson(path.join(state.site, 'package.json'), { dependencies: { kempo: 'file:../kempo' } });
    expect(getInstallInfo({ cwd: state.site, packageRoot: inside }).canUpdate === false, 'a file: dependency must be refused');
    await writeJson(path.join(state.site, 'package.json'), { dependencies: {} });
    expect(getInstallInfo({ cwd: state.site, packageRoot: inside }).canUpdate === false, 'kempo missing from package.json must be refused');
    await writeJson(path.join(state.site, 'package.json'), { dependencies: { kempo: `^${RUNNING_VERSION}` } });
    pass();
  },

  'the restart mode follows the environment': async ({ pass }) => {
    const none = () => false;
    expect(restartMode({}, none) === 'respawn', 'a hand-run server restarts itself');
    expect(restartMode({ pm_id: '0' }, none) === 'exit', 'pm2 restarts it');
    expect(restartMode({ INVOCATION_ID: 'x' }, none) === 'exit', 'systemd restarts it');
    expect(restartMode({}, () => true) === 'exit', 'a container restarts it');
    expect(restartMode({ pm_id: '0', KEMPO_RESTART: 'respawn' }, none) === 'respawn', 'KEMPO_RESTART overrides detection');
    expect(restartMode({ KEMPO_RESTART: 'nonsense' }, none) === 'respawn', 'an unknown KEMPO_RESTART is ignored');
    pass();
  },

  'a restart starts a replacement only when nothing else will, then exits': async ({ pass }) => {
    const spawned = [];
    const exits = [];
    const spawner = (...args) => { spawned.push(args); return { unref: () => {} }; };
    restartServer({ mode: 'exit', exit: code => exits.push(code), spawner });
    expect(spawned.length === 0 && exits[0] === RESTART_EXIT_CODE && RESTART_EXIT_CODE !== 0, 'exit mode only exits, with a failure code so an on-failure restart policy restarts it');
    restartServer({ mode: 'respawn', exit: code => exits.push(code), spawner });
    const [file, args, options] = spawned[0];
    expect(file === process.execPath && args[0] === '-e' && args[2] === String(process.pid), 'a watcher is started for this process');
    expect(JSON.parse(args[3])[0] === process.execPath, 'with the command that started this server');
    expect(options.detached && options.stdio === 'ignore' && options.cwd === process.cwd(), 'detached, in the same directory');
    expect(exits.length === 2 && exits[1] === 0, 'respawn mode exits cleanly too');
    pass();
  },

  'a restart really brings the same command back once the old process is gone': async ({ pass, fail }) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'kempo-restart-'));
    const marker = path.join(dir, 'came-back');
    const first = spawn(process.execPath, [path.join(root, 'tests', 'fixtures', 'restart-fixture', 'restart.js'), marker], { stdio: 'ignore' });
    const came = await waitFor(marker, 15000);
    first.kill();
    const pid = came ? await readFile(marker, 'utf8') : null;
    await rm(dir, { recursive: true, force: true });
    if(!came) return fail('the replacement process never started');
    expect(pid && Number(pid) !== first.pid, 'the replacement is a different process');
    pass();
  },

  'a restart is delayed so the response can be sent first': async ({ pass }) => {
    const exits = [];
    const timer = scheduleRestart({ delayMs: 30, mode: 'exit', exit: code => exits.push(code) });
    expect(exits.length === 0, 'it must not happen at once');
    await new Promise(resolve => setTimeout(resolve, 80));
    clearTimeout(timer);
    expect(exits.length === 1, 'it happens after the delay');
    pass();
  },

  'the manifest comes from the registry and a bad answer is an error, not a crash': async ({ pass }) => {
    const urls = [];
    const [, good] = await fetchManifest({ registry: 'https://registry.test/', fetcher: async url => { urls.push(url); return { ok: true, status: 200, json: async () => ({ version: '9.9.9', peerDependencies: { a: '>=1.0.0' } }) }; } });
    expect(good.version === '9.9.9' && good.peerDependencies.a === '>=1.0.0' && urls[0] === 'https://registry.test/kempo/latest', `read ${JSON.stringify(good)} from ${urls[0]}`);
    const [offline] = await fetchManifest({ fetcher: async () => { throw new Error('offline'); } });
    expect(offline?.code === 502, 'an unreachable registry is a 502');
    const [missing] = await fetchManifest({ version: '99.0.0', fetcher: async () => ({ ok: false, status: 404 }) });
    expect(missing?.code === 404, 'an unknown version is a 404');
    const [junk] = await fetchManifest({ fetcher: async () => ({ ok: true, status: 200, json: async () => ({ version: 'latest' }) }) });
    expect(junk?.code === 502, 'a manifest without a real version is refused');
    const [bad] = await fetchManifest({ version: '1.0.0; rm -rf /', fetcher: registry('1.0.0') });
    expect(bad?.code === 400, 'a version that is not x.y.z never reaches the registry');
    pass();
  },

  'the status says what is running, what is newest and whether it can be installed': async ({ pass }) => {
    resetUpdateStatus();
    const install = { canUpdate: true, reason: null };
    const [, offlineFirst] = await getUpdateStatus({ offline: true, install });
    expect(offlineFirst.latestVersion === null && offlineFirst.updateAvailable === false, 'offline never asks npm');
    const [, minorUpdate] = await getUpdateStatus({ force: true, fetcher: registry(NEXT_MINOR), install });
    expect(minorUpdate.updateAvailable && !minorUpdate.major && minorUpdate.latestVersion === NEXT_MINOR && minorUpdate.runningVersion === RUNNING_VERSION, `a newer minor: ${JSON.stringify(minorUpdate)}`);
    expect(typeof minorUpdate.bootId === 'string' && minorUpdate.canUpdate === true && ['respawn', 'exit'].includes(minorUpdate.restart), 'it carries the boot id, the install verdict and the restart mode');
    const [, bigger] = await getUpdateStatus({ force: true, fetcher: registry(NEXT_MAJOR), install });
    expect(bigger.updateAvailable && bigger.major, 'a newer major is flagged');
    const [, current] = await getUpdateStatus({ force: true, fetcher: registry(RUNNING_VERSION), install });
    expect(!current.updateAvailable && !current.major, 'the running version is not an update');
    const [, failed] = await getUpdateStatus({ force: true, fetcher: async () => { throw new Error('offline'); }, install });
    expect(failed.checkError && failed.latestVersion === RUNNING_VERSION, 'a failed check keeps the last answer and says why it failed');
    const [, cached] = await getUpdateStatus({ install, fetcher: async () => { throw new Error('must not be asked'); } });
    expect(cached.checkError === 'npm could not be reached', 'a recent answer is used without asking again, so the earlier failure is still the one reported');
    resetUpdateStatus();
    pass();
  },

  'an update is refused for a linked checkout, an older version and a failed install': async ({ pass }) => {
    const installed = [];
    const restarts = [];
    const base = { cwd: state.site, install: { canUpdate: true, reason: null }, run: fakeNpm(state.site, installed), restart: () => restarts.push(1) };

    const [linked] = await applyUpdate({ ...base, install: { canUpdate: false, reason: 'Kempo is linked from a local checkout, not installed from npm.' }, fetcher: registry(NEXT_MINOR) });
    expect(linked?.code === 409 && /linked/.test(linked.msg), 'a linked checkout is a 409');

    const [same] = await applyUpdate({ ...base, version: RUNNING_VERSION, fetcher: registry(RUNNING_VERSION) });
    expect(same?.code === 409, 'the running version is not installed again');

    const [older] = await applyUpdate({ ...base, version: '0.0.1', fetcher: registry('0.0.1') });
    expect(older?.code === 409, 'a downgrade is refused');

    const [npmFailed] = await applyUpdate({ ...base, run: async () => { throw Object.assign(new Error('x'), { stderr: 'npm ERR! code ERESOLVE\nnpm ERR! peer conflict' }); }, fetcher: registry(NEXT_MINOR) });
    expect(npmFailed?.code === 500 && /ERESOLVE|peer conflict/.test(npmFailed.msg), `npm's reason is reported: ${JSON.stringify(npmFailed)}`);

    const [notThere] = await applyUpdate({ ...base, run: async () => {}, fetcher: registry(NEXT_MINOR) });
    expect(notThere?.code === 500, 'an install that left the old version in place is an error');

    expect(installed.length === 0 && restarts.length === 0, 'none of these restarted the server');
    const [again] = await applyUpdate({ ...base, run: async () => { throw new Error('x'); }, fetcher: registry(NEXT_MINOR) });
    expect(again?.code === 500, 'a failure leaves the way clear for another try');
    pass();
  },

  'an update installs the version and only the peers that fell below its minimum, then restarts': async ({ pass }) => {
    const installed = [];
    const restarts = [];
    const [error, result] = await applyUpdate({
      cwd: state.site,
      install: { canUpdate: true, reason: null },
      run: fakeNpm(state.site, installed),
      restart: () => restarts.push(1),
      fetcher: registry(NEXT_MAJOR, { 'kempo-server': '>=3.4.0', 'kempo-ui': '>=0.6.0', 'kempo-css': '>=2.0.0' })
    });
    expect(!error, `the update failed: ${JSON.stringify(error)}`);
    expect(result.from === RUNNING_VERSION && result.to === NEXT_MAJOR, `from/to: ${JSON.stringify(result)}`);
    expect(JSON.stringify(installed[0].targets) === JSON.stringify([`kempo@${NEXT_MAJOR}`, 'kempo-server@latest']), `installed ${JSON.stringify(installed[0]?.targets)}: kempo-server was 3.0.0 so it is upgraded, kempo-ui and kempo-css are not installed here so npm handles them`);
    expect(installed[0].cwd === state.site, 'npm ran in the site directory');
    expect(restarts.length === 1, 'the restart was scheduled once');
    const [second] = await applyUpdate({ cwd: state.site, install: { canUpdate: true, reason: null }, run: fakeNpm(state.site, installed), restart: () => restarts.push(1), fetcher: registry(NEXT_MAJOR) });
    expect(second?.code === 409 && restarts.length === 1, 'a second click while the server is going down does nothing');
    pass();
  },

  'the scheduled check tells the people who can update, once per version': async ({ pass }) => {
    await purge();
    await seedDatabase();
    const [, created] = await createUser({ name: 'updates', email: ADMIN_EMAIL, password: 'UpdatesTest123!', emailVerified: true });
    state.adminId = created.user.id;
    await addUserToGroup(state.adminId, 'system:Administrators');
    const install = { canUpdate: true, reason: null };
    const notices = async () => (await db.select().from(notification).where(eq(notification.owner, 'kempo'))).filter(row => row.dedupeKey?.startsWith('update:'));

    await runUpdateCheck({ fetcher: registry(RUNNING_VERSION), install });
    expect((await notices()).length === 0, 'nothing newer, nothing said');

    await runUpdateCheck({ fetcher: registry(NEXT_MINOR), install: { canUpdate: false, reason: 'linked' } });
    expect((await notices()).length === 0, 'a site that cannot install it is not told to');

    await runUpdateCheck({ fetcher: registry(NEXT_MINOR), install });
    const [notice] = await notices();
    expect(notice && notice.dedupeKey === `update:${NEXT_MINOR}` && notice.title.includes(NEXT_MINOR), 'a newer version raises a notification');
    expect(notice.actions[0].href === '/admin/updates', 'that links to the updates screen');

    await db.update(notification).set({ updatedAt: MARKER }).where(eq(notification.id, notice.id));
    await runUpdateCheck({ fetcher: registry(NEXT_MINOR), install });
    const [after] = await notices();
    expect(after.updatedAt.getTime() === MARKER.getTime(), 'the same version is not raised again');

    await runUpdateCheck({ fetcher: registry(NEXT_MAJOR), install });
    const next = await notices();
    expect(next.length === 2 && next.some(row => /major/.test(row.message ?? '')), 'a newer version is a new notification, and a major one says so');

    await setSetting('system', 'update_check_enabled', false, 'boolean', false, 'x');
    await db.delete(notification).where(inArray(notification.id, next.map(row => row.id)));
    await runUpdateCheck({ fetcher: registry(NEXT_MINOR), install });
    expect((await notices()).length === 0, 'turned off, it does not even look');
    await setSetting('system', 'update_check_enabled', true, 'boolean', false, 'x');
    pass();
  },
});

export const afterAll = async () => {
  if(state.site) await rm(state.site, { recursive: true, force: true }).catch(() => {});
  if(databaseReachable) await purge();
};

export default databaseReachable
  ? buildTests()
  : { 'updates (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
