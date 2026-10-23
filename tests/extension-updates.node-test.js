import path from 'path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, like, sql } from 'drizzle-orm';
import { reachable, seedDatabase } from './helpers/db.js';

/*
  Updating installed extensions: asking npm about each, bringing the database in step with the version on disk when the server
  starts (the one place an extension's update takes effect), checking a set of updates against the site before anything is
  installed, staging them with kempo's, and the helper for an extension that writes a file into the site. The registry, npm and
  the restart are stood in; extension packages are small folders made here.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => import(pathToFileURL(path.join(root, relative)).href);

const db = (await load('server/db/index.js')).default;
const { extension, permission, notification, user, userGroup, session } = await load('server/db/schema.js');
const { createUser, addUserToGroup } = await load('server/sdk.js');
const layout = await load('server/utils/updates/siteLayout.js');
const fetchManifest = (await load('server/utils/updates/fetchManifest.js')).default;
const getExtensionUpdates = (await load('server/utils/updates/getExtensionUpdates.js')).default;
const { resetExtensionUpdates } = await load('server/utils/updates/getExtensionUpdates.js');
const extensionTargets = (await load('server/utils/updates/extensionTargets.js')).default;
const { extensionPlan } = await load('server/utils/updates/extensionTargets.js');
const prepareUpdate = (await load('server/utils/updates/prepareUpdate.js')).default;
const applyStagedUpdate = (await load('server/utils/updates/applyStagedUpdate.js')).default;
/* its own copy of the module: after a successful update it refuses another until the process restarts, which must not leak into other suites */
const applyUpdate = (await import(`${pathToFileURL(path.join(root, 'server/utils/updates/applyUpdate.js')).href}?extension-updates`)).default;
const runUpdateCheck = (await load('server/utils/updates/runUpdateCheck.js')).default;
const reconcileExtensions = (await load('server/utils/extensions/reconcileExtensions.js')).default;
const upgradeExtension = (await load('server/utils/extensions/upgradeExtension.js')).default;
const updateExtension = (await load('server/utils/extensions/updateExtension.js')).default;
const writeSiteFile = (await load('server/utils/extensions/writeSiteFile.js')).default;
const { RUNNING_VERSION } = await load('server/utils/updates/runtime.js');
const { isBreakingBump } = await load('server/utils/updates/helpers.js');
const { resetUpdateStatus } = await load('server/utils/updates/getUpdateStatus.js');

const databaseReachable = await reachable(db);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const [major, minor] = RUNNING_VERSION.split('.').map(Number);
const NEXT_KEMPO = `${major}.${minor + 1}.0`;
const install = { canUpdate: true, reason: null };
const PREFIX = 'xu-';
const ADMIN_EMAIL = 'extension-updates-test-admin@test.local';

const dirs = [];
const scratch = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kempo-extupd-'));
  dirs.push(dir);
  return dir;
};

const write = (file, text) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};

const read = file => readFileSync(file, 'utf8');

/* A fetcher that answers like the registry for the packages in `known`: { name: { version, peers } }. */
const registry = known => async url => {
  const [name] = decodeURIComponent(new URL(url).pathname.slice(1)).split('/latest');
  const found = known[name] ?? known[name.replace(/\/$/, '')];
  if(!found) return { ok: false, status: 404 };
  if(found.fail) throw new Error('offline');
  return { ok: true, status: 200, json: async () => ({ version: found.version, peerDependencies: found.peers ?? {} }) };
};

const putPackage = (dir, name, version, config = {}) => {
  write(path.join(dir, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
  write(path.join(dir, 'node_modules', name, 'kempo-config.json'), JSON.stringify(config));
};

const addRow = (name, version, kempo = {}) => db.insert(extension).values({ name, version, enabled: true, kempo, installedAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();

const purge = async () => {
  await db.delete(extension).where(like(extension.name, `${PREFIX}%`)).catch(() => {});
  await db.delete(permission).where(like(permission.owner, `${PREFIX}%`)).catch(() => {});
  await db.delete(notification).where(eq(notification.owner, 'kempo')).catch(() => {});
  await db.execute(sql.raw('DROP TABLE IF EXISTS "xu_upgrade_table"')).catch(() => {});
  const [row] = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL));
  if(row){
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
  resetExtensionUpdates();
  resetUpdateStatus();
};

export const afterAll = async () => {
  for(const dir of dirs) rmSync(dir, { recursive: true, force: true });
  if(databaseReachable) await purge();
};

/* A Docker volume site with an extension installed in it, and the running kempo's starter files. */
const makeSite = () => {
  const base = scratch();
  const seed = path.join(base, 'seed');
  write(path.join(seed, 'package.json'), '{"name":"site"}');
  write(path.join(seed, 'package-lock.json'), 'lock');
  write(path.join(seed, 'node_modules', 'kempo', 'package.json'), JSON.stringify({ version: RUNNING_VERSION }));
  write(path.join(seed, 'public', 'mine.html'), 'mine');
  putPackage(seed, `${PREFIX}shop`, '1.0.0', { permissions: [{ name: `${PREFIX}shop:read` }], settings: [{ name: 'a', value: 1, type: 'number' }] });
  const siteRoot = path.join(base, 'site');
  layout.seedSite({ siteRoot, seed });
  const oldRoot = path.join(base, 'old-kempo');
  write(path.join(oldRoot, 'app-public', 'x.html'), 'x');
  return { siteRoot, cwd: path.join(siteRoot, 'app'), oldRoot };
};

/* Stands in for npm: every target lands in the staged copy at its version, extensions with the config they would ship. */
const fakeNpm = (configs = {}) => async (targets, dir) => {
  for(const target of targets){
    const at = target.lastIndexOf('@');
    const name = target.slice(0, at);
    const version = target.slice(at + 1);
    putPackage(dir, name, version, configs[name] ?? {});
  }
};

const buildTests = () => ({
  'a step is breaking by semver: a new major, and a new minor while the major is still 0': async ({ pass }) => {
    expect(isBreakingBump('1.4.2', '2.0.0') && isBreakingBump('4.9.0', '5.0.0'), 'a new major is breaking');
    expect(!isBreakingBump('1.4.2', '1.5.0') && !isBreakingBump('1.4.2', '1.4.3') && !isBreakingBump('4.8.0', '4.9.0'), 'a new minor or patch is not, once the major is 1 or more');
    expect(isBreakingBump('0.1.1', '0.2.0') && isBreakingBump('0.9.0', '1.0.0') && isBreakingBump('0.0.3', '0.1.0'), 'while the major is 0 a new minor is the breaking step, which every extension kempo has relies on');
    expect(!isBreakingBump('0.1.1', '0.1.2') && !isBreakingBump('0.3.0', '0.3.7'), 'and a patch still is not');
    pass();
  },

  'a 0.x extension update is breaking when the minor changes': async ({ pass }) => {
    await purge();
    const dir = scratch();
    putPackage(dir, `${PREFIX}zero`, '0.1.1');
    await addRow(`${PREFIX}zero`, '0.1.1');
    const [, minor] = await extensionTargets({ names: [`${PREFIX}zero`], kempoVersion: RUNNING_VERSION, root: dir, fetcher: registry({ [`${PREFIX}zero`]: { version: '0.2.0' } }) });
    expect(minor.items[0].major === true, 'a new 0.x minor is flagged breaking');
    const [, patch] = await extensionTargets({ names: [`${PREFIX}zero`], kempoVersion: RUNNING_VERSION, root: dir, fetcher: registry({ [`${PREFIX}zero`]: { version: '0.1.2' } }) });
    expect(patch.items[0].major === false, 'a patch is not');
    resetExtensionUpdates();
    const [, listed] = await getExtensionUpdates({ force: true, fetcher: registry({ [`${PREFIX}zero`]: { version: '0.2.0' } }), root: dir });
    expect(listed.updates[0].major === true, 'and the Updates screen is told');
    resetExtensionUpdates();
    pass();
  },

  'extensions are brought up to date in dependency order, so an update script finds what it builds on current': async ({ pass }) => {
    await purge();
    const dir = scratch();
    /* named so that sorting them alphabetically would be the wrong order */
    putPackage(dir, `${PREFIX}a-top`, '1.1.0', { dependencies: [`${PREFIX}b-middle`] });
    putPackage(dir, `${PREFIX}b-middle`, '1.1.0', { dependencies: [`${PREFIX}c-base`] });
    putPackage(dir, `${PREFIX}c-base`, '1.1.0');
    putPackage(dir, `${PREFIX}d-loop-one`, '1.1.0', { dependencies: [`${PREFIX}d-loop-two`] });
    putPackage(dir, `${PREFIX}d-loop-two`, '1.1.0', { dependencies: [`${PREFIX}d-loop-one`] });
    for(const name of ['a-top', 'b-middle', 'c-base', 'd-loop-one', 'd-loop-two']) await addRow(`${PREFIX}${name}`, '1.0.0');

    const order = [];
    await reconcileExtensions({ root: dir, upgrade: async ({ name }) => { order.push(name.slice(PREFIX.length)); return [null, {}]; } });
    expect(order.indexOf('c-base') < order.indexOf('b-middle') && order.indexOf('b-middle') < order.indexOf('a-top'), `the base first, the top last: ${order}`);
    expect(order.includes('d-loop-one') && order.includes('d-loop-two') && order.length === 5, 'a dependency loop does not hang or drop anyone');
    pass();
  },

  'the registry answer for an extension, scoped names included, and nothing else reaches it': async ({ pass }) => {
    const urls = [];
    const fetcher = async url => { urls.push(url); return { ok: true, status: 200, json: async () => ({ version: '2.0.0', peerDependencies: { kempo: '>=4.8.0' } }) }; };
    const [, scoped] = await fetchManifest({ name: '@acme/shop', registry: 'https://r.test', fetcher });
    expect(scoped.name === '@acme/shop' && urls[0] === 'https://r.test/@acme%2Fshop/latest', `a scoped name is one path segment: ${urls[0]}`);
    const [bad] = await fetchManifest({ name: 'x; rm -rf /', fetcher });
    expect(bad?.code === 400 && urls.length === 1, 'a name that is not a package name never reaches the registry');
    pass();
  },

  'the check lists installed extensions that npm has a newer version of, and says what each needs': async ({ pass }) => {
    await purge();
    const dir = scratch();
    putPackage(dir, `${PREFIX}a`, '1.0.0');
    putPackage(dir, `${PREFIX}b`, '1.2.0');
    putPackage(dir, `${PREFIX}c`, '1.0.0');
    putPackage(dir, `${PREFIX}git-only`, '1.0.0');
    for(const name of ['a', 'b', 'c', 'git-only']) await addRow(`${PREFIX}${name}`, '1.0.0');
    const known = {
      [`${PREFIX}a`]: { version: '2.0.0', peers: { kempo: `>=${NEXT_KEMPO}` } },
      [`${PREFIX}b`]: { version: '1.2.0' },
      [`${PREFIX}c`]: { version: '1.1.0' },
    };

    const [, result] = await getExtensionUpdates({ force: true, fetcher: registry(known), root: dir });
    const names = result.updates.map(update => update.name);
    expect(names.join() === `${PREFIX}a,${PREFIX}c`, `newer ones only (one is current, one is not on npm): ${names}`);
    const a = result.updates[0];
    expect(a.installedVersion === '1.0.0' && a.latestVersion === '2.0.0' && a.major === true && a.kempoRequired === NEXT_KEMPO, `a major update that needs a newer Kempo: ${JSON.stringify(a)}`);
    expect(result.updates[1].major === false, 'a minor one is not major');

    const [, again] = await getExtensionUpdates({ fetcher: async () => { throw new Error('must not ask'); }, root: dir });
    expect(again.updates.length === 2, 'a recent answer is reused');

    resetExtensionUpdates();
    const [, down] = await getExtensionUpdates({ force: true, fetcher: registry(Object.fromEntries(['a', 'b', 'c', 'git-only'].map(name => [`${PREFIX}${name}`, { fail: true }]))), root: dir });
    expect(down.checkError === 'npm could not be reached' && down.updates.length === 0, 'when npm cannot be reached at all the screen is told, not left empty');
    resetExtensionUpdates();
    pass();
  },

  'a set of updates is checked before anything is installed': async ({ pass }) => {
    await purge();
    const dir = scratch();
    putPackage(dir, `${PREFIX}a`, '1.0.0');
    putPackage(dir, `${PREFIX}current`, '2.0.0');
    await addRow(`${PREFIX}a`, '1.0.0');
    await addRow(`${PREFIX}current`, '2.0.0');
    const known = {
      [`${PREFIX}a`]: { version: '1.5.0' },
      [`${PREFIX}current`]: { version: '2.0.0' },
      [`${PREFIX}needs`]: { version: '3.0.0', peers: { kempo: `>=${major + 1}.0.0` } },
    };
    putPackage(dir, `${PREFIX}needs`, '2.0.0');
    await addRow(`${PREFIX}needs`, '2.0.0');
    const fetcher = registry(known);

    const [ok, good] = await extensionTargets({ names: [`${PREFIX}a`], kempoVersion: RUNNING_VERSION, root: dir, fetcher });
    expect(!ok && good.targets.join() === `${PREFIX}a@1.5.0` && good.items[0].from === '1.0.0' && good.items[0].major === false, 'a newer extension is a target');
    const [upToDate] = await extensionTargets({ names: [`${PREFIX}current`], kempoVersion: RUNNING_VERSION, root: dir, fetcher });
    expect(upToDate?.code === 409 && upToDate.msg.includes(`${PREFIX}current`), 'one already up to date is refused, by name');
    const [needs] = await extensionTargets({ names: [`${PREFIX}needs`], kempoVersion: RUNNING_VERSION, root: dir, fetcher });
    expect(needs?.code === 409 && /needs Kempo/.test(needs.msg), 'one that needs a newer Kempo than will be running is refused with the reason');
    const [together] = await extensionTargets({ names: [`${PREFIX}needs`], kempoVersion: `${major + 1}.0.0`, root: dir, fetcher });
    expect(!together, 'but is fine when that Kempo is installed with it');
    const [unknown] = await extensionTargets({ names: [`${PREFIX}ghost`], kempoVersion: RUNNING_VERSION, root: dir, fetcher });
    expect(unknown?.code === 404, 'one that is not installed is refused');
    const [bad] = await extensionTargets({ names: ['a b; c'], kempoVersion: RUNNING_VERSION, root: dir, fetcher });
    expect(bad?.code === 400, 'a name that is not a package name never reaches npm');
    pass();
  },

  'the plan says what each extension adds and whether it is breaking': async ({ pass }) => {
    const dir = scratch();
    putPackage(dir, `${PREFIX}p`, '2.0.0', { permissions: [{ name: 'p:a' }, { name: 'p:b' }], settings: [{ name: 's' }], jobs: [{ name: 'j', every: '1h', callback: './j.js' }], 'public-scope': 'pscope' });
    putPackage(dir, `${PREFIX}q`, '1.1.0', { breaking: true });
    putPackage(dir, `${PREFIX}r`, '1.1.0');
    const rows = {
      p: { name: `${PREFIX}p`, enabled: false, kempo: { permissions: [{ name: 'p:a' }] } },
      q: { name: `${PREFIX}q`, enabled: false, kempo: {} },
      r: { name: `${PREFIX}r`, enabled: false, kempo: {} },
    };
    const items = [
      { name: `${PREFIX}p`, row: rows.p, from: '1.0.0', to: '2.0.0', major: true },
      { name: `${PREFIX}q`, row: rows.q, from: '1.0.0', to: '1.1.0', major: false },
      { name: `${PREFIX}r`, row: rows.r, from: '1.0.0', to: '1.1.0', major: false },
    ];
    const [error, plan] = await extensionPlan({ dir, items });
    expect(!error, `plan: ${JSON.stringify(error)}`);
    expect(plan[0].breaking && plan[0].major && plan[0].adds.permissions === 1 && plan[0].adds.settings === 1 && plan[0].adds.jobs === 1, `a major release adds only what is new: ${JSON.stringify(plan[0])}`);
    expect(plan[1].breaking && !plan[1].major, 'a minor release that says it is breaking is breaking');
    expect(!plan[2].breaking, 'an ordinary minor release is not');
    const [stopped] = await extensionPlan({ dir, items: [{ ...items[2], to: '1.1.0' }].map(item => ({ ...item })), executor: undefined });
    expect(stopped === null, 'nothing is wrong with an ordinary one');
    pass();
  },

  'an extension is brought up to date when the server starts, once, and a failure is retried at the next start': async ({ pass }) => {
    await purge();
    const dir = scratch();
    for(const name of ['up', 'fail', 'down', 'same', 'gone']) await addRow(`${PREFIX}${name}`, name === 'down' ? '3.0.0' : '1.0.0');
    putPackage(dir, `${PREFIX}up`, '1.1.0');
    putPackage(dir, `${PREFIX}fail`, '2.0.0');
    putPackage(dir, `${PREFIX}down`, '2.0.0');
    putPackage(dir, `${PREFIX}same`, '1.0.0');

    const calls = [];
    const upgrade = async ({ name, record }) => {
      calls.push(`${name}:${record.version}`);
      return name === `${PREFIX}fail` ? [{ code: 500, msg: 'update.js broke' }, null] : [null, {}];
    };

    const [error, result] = await reconcileExtensions({ root: dir, upgrade });
    expect(!error, `reconcile: ${JSON.stringify(error)}`);
    expect(calls.sort().join() === `${PREFIX}fail:1.0.0,${PREFIX}up:1.0.0`, `only the newer ones were upgraded, from their recorded version: ${calls}`);
    expect(result.failed.length === 1 && result.failed[0].major === true && /update.js broke/.test(result.failed[0].reason), `the failure is reported, and it was a major one: ${JSON.stringify(result.failed)}`);
    expect(result.reverted.map(item => item.name).join() === `${PREFIX}down` && result.reverted[0].to === '2.0.0', 'one that is older than its row means the site went back: the row follows, no script runs');
    expect(!calls.some(call => call.startsWith(`${PREFIX}down`)), 'going back never runs an update script');
    const rows = Object.fromEntries((await db.select().from(extension).where(like(extension.name, `${PREFIX}%`))).map(row => [row.name, row.version]));
    expect(rows[`${PREFIX}fail`] === '1.0.0', 'a failed upgrade gives the row its old version back so it is tried again');
    expect(rows[`${PREFIX}down`] === '2.0.0' && rows[`${PREFIX}gone`] === '1.0.0', 'an extension that is not installed is left alone');

    calls.length = 0;
    await reconcileExtensions({ root: dir, upgrade: async ({ name, record }) => { calls.push(`${name}:${record.version}`); return [null, {}]; } });
    expect(calls.join() === `${PREFIX}fail:1.0.0`, `the next start tries only the failed one again: ${calls}`);
    pass();
  },

  'two servers starting together do not both upgrade an extension': async ({ pass }) => {
    await purge();
    const dir = scratch();
    await addRow(`${PREFIX}race`, '1.0.0');
    putPackage(dir, `${PREFIX}race`, '1.1.0');
    let upgrades = 0;
    const upgrade = async () => { upgrades++; await new Promise(resolve => setTimeout(resolve, 30)); return [null, {}]; };
    await Promise.all([reconcileExtensions({ root: dir, upgrade }), reconcileExtensions({ root: dir, upgrade })]);
    expect(upgrades === 1, `the row is claimed first, so it ran ${upgrades} times`);
    pass();
  },

  'upgrading an extension adds its tables, columns and what it newly declares, and runs its update script': async ({ pass }) => {
    await purge();
    const dir = scratch();
    const ext = `${PREFIX}real`;
    globalThis.xuPg = await import('drizzle-orm/pg-core');
    const writeVersion = (version, columns, config, updateScript) => {
      putPackage(dir, ext, version, { schema: './schema.js', ...config });
      write(path.join(dir, 'node_modules', ext, 'schema.js'), `const { pgTable, text } = globalThis.xuPg;
export const thing = pgTable('xu_upgrade_table', { id: text('id').primaryKey()${columns} });
`);
      if(updateScript) write(path.join(dir, 'node_modules', ext, 'update.js'), updateScript);
    };

    writeVersion('1.0.0', '', { permissions: [{ name: `${ext}:read` }] });
    await db.execute(sql.raw('CREATE TABLE "xu_upgrade_table" ("id" text PRIMARY KEY)'));
    await addRow(ext, '1.0.0', { permissions: [{ name: `${ext}:read` }] });

    globalThis.xuUpdateCalls = [];
    writeVersion('2.0.0', ", extra: text('extra')", {
      permissions: [{ name: `${ext}:read` }, { name: `${ext}:write`, description: 'new' }],
      settings: [{ name: 'mode', value: 'fast', type: 'string' }],
    }, 'export default async args => { globalThis.xuUpdateCalls.push(args); };');

    const [row] = await db.select().from(extension).where(eq(extension.name, ext));
    const [error, result] = await upgradeExtension({ name: ext, record: row, extRoot: path.join(dir, 'node_modules', ext) });
    expect(!error && result.oldVersion === '1.0.0' && result.newVersion === '2.0.0', `upgrade: ${JSON.stringify(error)}`);
    const columns = (await db.execute(sql.raw("select column_name from information_schema.columns where table_name = 'xu_upgrade_table'"))).map?.(item => item.column_name) ?? [];
    expect(columns.includes('extra'), `the new column was added to the existing table: ${columns}`);
    expect((await db.select().from(permission).where(eq(permission.name, `${ext}:write`))).length === 1, 'the permission it newly declares exists');
    expect(globalThis.xuUpdateCalls[0].oldVersion === '1.0.0' && globalThis.xuUpdateCalls[0].newVersion === '2.0.0' && globalThis.xuUpdateCalls[0].newKempo.settings.length === 1, 'update.js was given both versions and what the new one declares');
    const [after] = await db.select().from(extension).where(eq(extension.name, ext));
    expect(after.version === '2.0.0' && after.kempo.settings.length === 1, 'the row now says 2.0.0 and holds the new declaration');
    delete globalThis.xuUpdateCalls;
    delete globalThis.xuPg;
    pass();
  },

  'a staged update can hold extensions with or without kempo, and a major extension needs the owner to confirm': async ({ pass }) => {
    await purge();
    await addRow(`${PREFIX}shop`, '1.0.0', { permissions: [{ name: `${PREFIX}shop:read` }] });
    const { siteRoot, cwd, oldRoot } = makeSite();
    const fetcher = registry({ [`${PREFIX}shop`]: { version: '2.0.0' } });

    const [error, result] = await prepareUpdate({ version: null, extensions: [`${PREFIX}shop`], siteRoot, cwd, oldRoot, install, run: fakeNpm({ [`${PREFIX}shop`]: { permissions: [{ name: `${PREFIX}shop:read` }, { name: `${PREFIX}shop:write` }] } }), fetcher });
    expect(!error, `prepare: ${JSON.stringify(error)}`);
    expect(result.kempoUpdate === false && result.packages.join() === `${PREFIX}shop@2.0.0`, 'only the extension is installed, kempo is left alone');
    expect(result.plan.extensions[0].breaking && result.plan.extensions[0].adds.permissions === 1 && result.plan.breaking, 'a major extension makes the update breaking, and its additions are listed');
    expect(layout.readState(siteRoot, 'staged').kempoUpdate === false, 'and the staged state says kempo is not part of it');

    const restarts = [];
    const backups = [];
    const options = { siteRoot, cwd, restart: () => restarts.push(1), backup: async ({ file }) => { backups.push(file); write(file, 'dump'); return [null, { file }]; } };
    const [asked] = await applyStagedUpdate(options);
    expect(asked?.code === 409 && asked.details.confirm === 'breaking' && asked.details.extensions.join() === `${PREFIX}shop`, `it asks first and names the extension: ${JSON.stringify(asked)}`);
    expect(restarts.length === 0 && backups.length === 0, 'nothing happened meanwhile');

    const [done, switched] = await applyStagedUpdate({ ...options, confirm: { breaking: true } });
    expect(!done && switched.to === RUNNING_VERSION && backups.length === 1, `confirmed: ${JSON.stringify(done)}`);
    const sw = layout.readState(siteRoot, 'switch');
    expect(sw.packages.join() === `${PREFIX}shop@2.0.0` && sw.dbBackup === backups[0] && sw.filesBackup === null, 'the switch records what is in it and the backup, and changed no starter files');

    layout.performSwitch(siteRoot);
    expect(JSON.parse(read(path.join(cwd, 'node_modules', `${PREFIX}shop`, 'package.json'))).version === '2.0.0', 'the extension is at the new version after the switch');
    expect(JSON.parse(read(path.join(cwd, 'node_modules', 'kempo', 'package.json'))).version === RUNNING_VERSION, 'and kempo is unchanged');
    pass();
  },

  'kempo and extensions are installed together in one run, and a minor extension needs no backup': async ({ pass }) => {
    await purge();
    await addRow(`${PREFIX}shop`, '1.0.0');
    const { siteRoot, cwd, oldRoot } = makeSite();
    const ran = [];
    const run = async (targets, dir) => { ran.push(targets); await fakeNpm()(targets, dir); };
    const fetcher = async url => {
      if(decodeURIComponent(new URL(url).pathname).startsWith('/kempo/')) return { ok: true, status: 200, json: async () => ({ version: NEXT_KEMPO, peerDependencies: {} }) };
      return { ok: true, status: 200, json: async () => ({ version: '1.1.0', peerDependencies: { kempo: `>=${NEXT_KEMPO}` } }) };
    };
    const [error, result] = await prepareUpdate({ extensions: [`${PREFIX}shop`], siteRoot, cwd, oldRoot, install, run, fetcher });
    expect(!error, `prepare: ${JSON.stringify(error)}`);
    expect(ran.length === 1 && ran[0].join() === `kempo@${NEXT_KEMPO},${PREFIX}shop@1.1.0`, `one npm run for both, so they are consistent with each other: ${ran}`);
    expect(result.kempoUpdate && !result.plan.breaking, 'a minor extension alongside kempo is not breaking');
    const restarts = [];
    const [done] = await applyStagedUpdate({ siteRoot, cwd, restart: () => restarts.push(1), backup: async () => { throw new Error('no backup needed'); } });
    expect(!done && restarts.length === 1, 'it switches without a backup or a question');
    pass();
  },

  'an in-place update installs kempo and extensions in one run, and null leaves kempo alone': async ({ pass }) => {
    await purge();
    await addRow(`${PREFIX}shop`, '1.0.0');
    const dir = scratch();
    putPackage(dir, 'kempo', RUNNING_VERSION);
    putPackage(dir, `${PREFIX}shop`, '1.0.0');
    const ran = [];
    const restarts = [];
    const run = async (targets, cwd) => { ran.push(targets); await fakeNpm()(targets, cwd); };
    const fetcher = registry({ [`${PREFIX}shop`]: { version: '1.0.1' } });

    const [error, result] = await applyUpdate({ version: null, extensions: [`${PREFIX}shop`], cwd: dir, install, run, restart: () => restarts.push(1), fetcher });
    expect(!error && ran[0].join() === `${PREFIX}shop@1.0.1` && result.to === RUNNING_VERSION && restarts.length === 1, `an extension alone: ${JSON.stringify(error)} ${ran}`);
    const [nothing] = await applyUpdate({ version: null, extensions: [], cwd: dir, install, run, restart: () => {}, fetcher });
    expect(nothing?.code === 400, 'with nothing chosen there is nothing to do');
    pass();
  },

  'the single-extension update refuses on a volume site, so the staged flow cannot be bypassed': async ({ pass }) => {
    process.env.KEMPO_SITE_ROOT = '/site';
    try {
      const [error] = await updateExtension({ name: `${PREFIX}shop` });
      expect(error?.code === 409 && /Updates screen/.test(error.msg), 'refused');
    } finally {
      delete process.env.KEMPO_SITE_ROOT;
    }
    pass();
  },

  'the scheduled check says which extension updates are waiting, once for each distinct set': async ({ pass }) => {
    await purge();
    await seedDatabase();
    const [, created] = await createUser({ name: 'extension updates', email: ADMIN_EMAIL, password: 'ExtUpdates123!', emailVerified: true });
    await addUserToGroup(created.user.id, 'system:Administrators');
    const dir = scratch();
    putPackage(dir, `${PREFIX}a`, '1.0.0');
    putPackage(dir, `${PREFIX}b`, '1.0.0');
    await addRow(`${PREFIX}a`, '1.0.0');
    await addRow(`${PREFIX}b`, '1.0.0');

    /* the check reads the packages from the site's own folder, so it runs from there */
    const here = process.cwd();
    process.chdir(dir);
    try {
      const notices = async () => (await db.select().from(notification).where(eq(notification.owner, 'kempo'))).filter(row => row.dedupeKey?.startsWith('extension-updates:'));
      const kempoSame = { ok: true, status: 200, json: async () => ({ version: RUNNING_VERSION, peerDependencies: {} }) };
      const answer = known => async url => (decodeURIComponent(new URL(url).pathname).startsWith('/kempo/') ? kempoSame : registry(known)(url));

      await runUpdateCheck({ fetcher: answer({}), install });
      expect((await notices()).length === 0, 'nothing newer, nothing said');

      await runUpdateCheck({ fetcher: answer({ [`${PREFIX}a`]: { version: '2.0.0' } }), install });
      const [first] = await notices();
      expect(first && /xu-a 2\.0\.0 is available/.test(first.title) && first.message.includes('(major)') && first.actions[0].href === '/admin/updates', `one update is named: ${first?.title}`);

      await db.update(notification).set({ updatedAt: new Date(0) }).where(eq(notification.id, first.id));
      resetExtensionUpdates();
      await runUpdateCheck({ fetcher: answer({ [`${PREFIX}a`]: { version: '2.0.0' } }), install });
      expect((await notices()).length === 1 && (await notices())[0].updatedAt.getTime() === 0, 'the same set is not raised again');

      resetExtensionUpdates();
      await runUpdateCheck({ fetcher: answer({ [`${PREFIX}a`]: { version: '2.0.0' }, [`${PREFIX}b`]: { version: '1.1.0' } }), install });
      const all = await notices();
      expect(all.length === 2 && all.some(row => /2 extension updates are available/.test(row.title)), 'a different set is a new notification');

      resetExtensionUpdates();
      await runUpdateCheck({ fetcher: answer({ [`${PREFIX}a`]: { version: '2.0.0' } }), install: { canUpdate: false, reason: 'linked' } });
      expect((await notices()).length === 2, 'a site that cannot install updates is not told about them');
    } finally {
      process.chdir(here);
    }
    pass();
  },

  'a file an extension writes into the site follows the same rule as kempo\'s starter files': async ({ pass }) => {
    const cwd = scratch();
    const write1 = content => writeSiteFile({ owner: 'xu-blog', path: 'public/blog/template.html', content, cwd })[1].status;
    const file = path.join(cwd, 'public', 'blog', 'template.html');

    expect(write1('v1') === 'written' && read(file) === 'v1', 'a new file is written');
    expect(write1('v1') === 'current', 'the same content is nothing to do');
    expect(write1('v2') === 'written' && read(file) === 'v2', 'a file nobody edited is replaced by the next version');
    writeFileSync(file, 'the owner changed this');
    expect(write1('v3') === 'kept' && read(file) === 'the owner changed this', "the owner's edit is kept");
    rmSync(file);
    expect(write1('v3') === 'deleted' && !existsSync(file), 'a deleted file stays deleted');

    expect(writeSiteFile({ owner: 'xu-blog', path: '../escape.html', content: 'x', cwd })[0]?.code === 400, 'a path that leaves the site is refused');
    expect(writeSiteFile({ owner: 'xu-blog', path: 'node_modules/x.js', content: 'x', cwd })[0]?.code === 400, 'so is one outside public/ and templates/');
    expect(writeSiteFile({ owner: '../x', path: 'public/x.html', content: 'x', cwd })[0]?.code === 400, 'and an owner that is not an extension name');
    expect(writeSiteFile({ owner: '@acme/blog', path: 'templates/t.html', content: 'x', cwd })[1].status === 'written' && existsSync(path.join(cwd, '.kempo', 'shipped', '@acme__blog.json')), 'a scoped extension keeps its own record');
    pass();
  },
});

export default databaseReachable
  ? buildTests()
  : { 'extension updates (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
