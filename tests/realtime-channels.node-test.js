import { sql, eq } from 'drizzle-orm';
import db from '../server/db/index.js';
import { extension, user, userGroup, group, groupPermission, permission } from '../server/db/schema.js';
import { invalidateScopeCache } from '../server/utils/extensions/scopeCache.js';
import createUser from '../server/utils/users/createUser.js';
import createGroup from '../server/utils/groups/createGroup.js';
import createPermission from '../server/utils/permissions/createPermission.js';
import addPermissionToGroup from '../server/utils/permissions/addPermissionToGroup.js';
import addUserToGroup from '../server/utils/groups/addUserToGroup.js';
import parseDuration from '../server/utils/realtime/duration.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { registerChannel, unregisterChannel, resolveChannel, authorizeSubscription, loadMessageHandler, clearMessageHandlerCache } from '../server/utils/realtime/channels.js';

/*
  Channel registration, resolution and authorization.

  The parts that need no database always run. The parts that resolve a channel an extension declared, or
  check a real permission, need one, and are replaced by a single "(SKIPPED)" entry when none is reachable
  so a checkout without Postgres still runs `npm test`. Check for that name before believing a green run.
*/

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const OWNER = 'realtime-channels-test';
const registered = [];

const register = (options) => {
  const result = registerChannel({ owner: OWNER, ...options });
  if(result[0] === null) registered.push(result[1].channel);
  return result;
};

const cleanupRegistered = () => {
  for(const channel of registered.splice(0)) unregisterChannel(channel);
};

const pureTests = {
  'durations parse from numbers and unit strings, and reject anything else': async ({ pass }) => {
    const valid = [['250ms', 250], ['30s', 30000], ['15m', 900000], ['24h', 86400000], ['7d', 604800000], ['1.5h', 5400000], [1000, 1000], [' 2h ', 7200000]];
    for(const [input, expected] of valid){
      expect(parseDuration(input) === expected, `${JSON.stringify(input)} should parse to ${expected}, got ${parseDuration(input)}`);
    }

    for(const input of ['', 'abc', '24', '-5m', '0s', 0, -1, NaN, Infinity, null, undefined, {}, '5 minutes']){
      expect(parseDuration(input) === null, `${JSON.stringify(input)} should be rejected, got ${parseDuration(input)}`);
    }
    pass('duration parsing');
  },

  'a channel needs a permission or an authorize function: channels are closed by default': async ({ pass }) => {
    const [error] = register({ name: 'no-guard' });
    expect(error?.code === 400, `expected a 400, got ${JSON.stringify(error)}`);
    expect(/closed by default/.test(error.msg), 'the error should say channels are closed by default');

    const [permissionError, byPermission] = register({ name: 'by-permission', permission: 'x:y:read' });
    expect(permissionError === null && byPermission.channel === `${OWNER}:by-permission`, 'a permission should be enough');

    const [authorizeError] = register({ name: 'by-function', authorize: () => true });
    expect(authorizeError === null, 'an authorize function should be enough');

    cleanupRegistered();
    pass('default deny');
  },

  'the owner prefix is enforced and reserved names are refused': async ({ pass }) => {
    for(const owner of ['', 'Has Space', 'UPPER', 'user', 'a:b', undefined, 5]){
      const [error] = registerChannel({ owner, name: 'ok', permission: 'x:y:read' });
      expect(error?.code === 400, `owner ${JSON.stringify(owner)} should be refused, got ${JSON.stringify(error)}`);
    }

    for(const name of ['', 'has space', 'a:b', 'a/b', '.leading', undefined]){
      const [error] = register({ name, permission: 'x:y:read' });
      expect(error?.code === 400, `name ${JSON.stringify(name)} should be refused, got ${JSON.stringify(error)}`);
    }

    // A scoped package name is a valid owner, since that is what an extension is called
    const [scopedError, scoped] = registerChannel({ owner: '@acme/widgets', name: 'events', permission: 'x:y:read' });
    expect(scopedError === null && scoped.channel === '@acme/widgets:events', `a scoped owner should work, got ${JSON.stringify(scopedError)}`);
    unregisterChannel(scoped.channel);
    pass('prefix enforcement');
  },

  'registering the same channel twice is a conflict': async ({ pass }) => {
    const [first] = register({ name: 'dupe', permission: 'x:y:read' });
    expect(first === null, 'the first registration should succeed');

    const [second] = register({ name: 'dupe', permission: 'x:y:read' });
    expect(second?.code === 409, `expected a 409, got ${JSON.stringify(second)}`);

    cleanupRegistered();
    pass('collision');
  },

  'retention is validated and defaults to 24 hours': async ({ pass }) => {
    const [, defaulted] = register({ name: 'default-retention', permission: 'x:y:read' });
    expect(defaulted.channel, 'should register');
    expect((await resolveChannel(defaulted.channel)).retentionMs === 86400000, 'default retention should be 24 hours');

    const [, custom] = register({ name: 'custom-retention', permission: 'x:y:read', retention: '90m' });
    expect((await resolveChannel(custom.channel)).retentionMs === 5400000, 'a string retention should be parsed');

    const [error] = register({ name: 'bad-retention', permission: 'x:y:read', retention: 'forever' });
    expect(error?.code === 400, `an invalid retention should be a 400, got ${JSON.stringify(error)}`);

    cleanupRegistered();
    pass('retention');
  },

  'a user\'s own channel is implicit and only that user may subscribe': async ({ pass }) => {
    const config = await resolveChannel('user:abc123');
    expect(config?.source === 'implicit' && config.persist === false, `unexpected config ${JSON.stringify(config)}`);

    const [ownError, own] = await authorizeSubscription({ config, user: { id: 'abc123' } });
    expect(ownError === null && own === true, 'the owner should be allowed');

    const [, other] = await authorizeSubscription({ config, user: { id: 'someone-else' } });
    expect(other === false, 'another user must not be allowed');

    expect(await resolveChannel('user:') === null, 'an empty user id is not a channel');
    pass('user channels');
  },

  'an unknown or malformed channel does not resolve': async ({ pass }) => {
    for(const channel of ['', 'nocolon', undefined, null, 5, {}]){
      expect(await resolveChannel(channel) === null, `${JSON.stringify(channel)} should not resolve`);
    }
    pass('malformed channels');
  },

  'authorize functions decide, and a throwing one is a 500 not an open door': async ({ pass }) => {
    const [, allow] = register({ name: 'allow', authorize: () => true });
    const [, deny] = register({ name: 'deny', authorize: () => false });
    const [, boom] = register({ name: 'boom', authorize: () => { throw new Error('nope'); } });
    const [, seen] = register({ name: 'seen', authorize: ({ user, channel }) => user.id === 'u1' && channel === `${OWNER}:seen` });

    const asUser = { id: 'u1' };
    expect((await authorizeSubscription({ config: await resolveChannel(allow.channel), user: asUser }))[1] === true, 'allow should allow');
    expect((await authorizeSubscription({ config: await resolveChannel(deny.channel), user: asUser }))[1] === false, 'deny should deny');

    const [boomError, boomResult] = await authorizeSubscription({ config: await resolveChannel(boom.channel), user: asUser });
    expect(boomError?.code === 500 && boomResult === null, `a throwing authorize should be a 500, got ${JSON.stringify([boomError, boomResult])}`);

    expect((await authorizeSubscription({ config: await resolveChannel(seen.channel), user: asUser }))[1] === true, 'authorize should receive the user and channel');
    expect((await authorizeSubscription({ config: await resolveChannel(seen.channel), user: { id: 'u2' } }))[1] === false, 'authorize should see the different user');

    const [anonymousError] = await authorizeSubscription({ config: await resolveChannel(allow.channel), user: null });
    expect(anonymousError?.code === 401, 'no user should be a 401');

    cleanupRegistered();
    pass('authorize functions');
  },

  'scope, onMessage and dropIfBackedUp are validated, and a process channel cannot persist': async ({ pass }) => {
    const [defaultError, defaulted] = register({ name: 'defaults', permission: 'x:y:read' });
    expect(defaultError === null, 'should register');
    const config = await resolveChannel(defaulted.channel);
    expect(config.scope === 'cluster' && config.onMessage === null && config.dropIfBackedUp === false, `unexpected defaults ${JSON.stringify(config)}`);

    const handler = async () => 'handled';
    const [, custom] = register({ name: 'custom', permission: 'x:y:read', scope: 'process', onMessage: handler, dropIfBackedUp: true });
    const customConfig = await resolveChannel(custom.channel);
    expect(customConfig.scope === 'process' && customConfig.onMessage === handler && customConfig.dropIfBackedUp === true, 'options should be kept');

    const [scopeError] = register({ name: 'bad-scope', permission: 'x:y:read', scope: 'everywhere' });
    expect(scopeError?.code === 400, `an unknown scope should be a 400, got ${JSON.stringify(scopeError)}`);

    const [persistError] = register({ name: 'process-persist', permission: 'x:y:read', scope: 'process', persist: true });
    expect(persistError?.code === 400 && /cannot persist/.test(persistError.msg), `a process channel cannot persist, got ${JSON.stringify(persistError)}`);

    for(const onMessage of ['./handler.js', 5, {}, true]){
      const [error] = register({ name: 'bad-handler', permission: 'x:y:read', onMessage });
      expect(error?.code === 400, `onMessage ${JSON.stringify(onMessage)} should be refused, got ${JSON.stringify(error)}`);
    }

    cleanupRegistered();
    pass('channel options');
  },

  'a code-registered handler loads as itself, and a channel with none loads null': async ({ pass }) => {
    const handler = async () => 1;
    const [, withHandler] = register({ name: 'with-handler', permission: 'x:y:read', onMessage: handler });
    const [, without] = register({ name: 'without-handler', permission: 'x:y:read' });

    expect(await loadMessageHandler(await resolveChannel(withHandler.channel)) === handler, 'should return the registered function');
    expect(await loadMessageHandler(await resolveChannel(without.channel)) === null, 'a channel with no handler should load null');

    cleanupRegistered();
    pass('code handlers');
  }
};

const EXTENSION = 'realtime-channels-test-ext';
const MEMBER = { name: 'Realtime Member', email: 'realtime-channels-member@test.local', password: 'RealtimeMember123!' };
const OUTSIDER = { name: 'Realtime Outsider', email: 'realtime-channels-outsider@test.local', password: 'RealtimeOutsider123!' };
const GROUP = 'realtime-channels-test:Readers';
const PERMISSION = 'realtime-channels-test:feed:read';

const purge = async () => {
  await db.delete(extension).where(eq(extension.name, EXTENSION)).catch(() => {});
  invalidateScopeCache();
  for(const email of [MEMBER.email, OUTSIDER.email]){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
  await db.delete(groupPermission).where(eq(groupPermission.groupName, GROUP)).catch(() => {});
  await db.delete(group).where(eq(group.name, GROUP)).catch(() => {});
  await db.delete(permission).where(eq(permission.name, PERMISSION)).catch(() => {});
};

const declareExtension = async (channels, enabled = true) => {
  await db.delete(extension).where(eq(extension.name, EXTENSION));
  await db.insert(extension).values({
    name: EXTENSION,
    version: '1.0.0',
    enabled,
    kempo: { realtime: { channels } },
    installedAt: new Date(),
    updatedAt: new Date()
  });
  invalidateScopeCache();
};

const databaseTests = () => ({
  'a channel an extension declares in kempo-config.json resolves from the database': async ({ pass }) => {
    await purge();
    try {
      await declareExtension([
        { name: 'status', permission: 'ext:status:read', persist: true, retention: '2h' },
        { name: 'no-permission', persist: true }
      ]);

      const config = await resolveChannel(`${EXTENSION}:status`);
      expect(config?.source === 'extension', `expected an extension channel, got ${JSON.stringify(config)}`);
      expect(config.persist === true && config.retentionMs === 7200000 && config.permission === 'ext:status:read', `unexpected config ${JSON.stringify(config)}`);

      expect(await resolveChannel(`${EXTENSION}:no-permission`) === null, 'a declared channel with no permission is closed by default, so it must not resolve');
      expect(await resolveChannel(`${EXTENSION}:not-declared`) === null, 'an undeclared channel must not resolve');
      expect(await resolveChannel('some-other-extension:status') === null, 'another extension\'s prefix must not resolve');
    } finally {
      await purge();
    }
    pass('declared channels');
  },

  'disabling an extension closes its channels': async ({ pass }) => {
    await purge();
    try {
      await declareExtension([{ name: 'status', permission: 'ext:status:read' }], true);
      expect(await resolveChannel(`${EXTENSION}:status`) !== null, 'should resolve while enabled');

      await declareExtension([{ name: 'status', permission: 'ext:status:read' }], false);
      expect(await resolveChannel(`${EXTENSION}:status`) === null, 'should not resolve once disabled');
    } finally {
      await purge();
    }
    pass('disabled extension');
  },

  'a code registration wins over a declaration of the same name': async ({ pass }) => {
    await purge();
    try {
      await declareExtension([{ name: 'clash', permission: 'ext:declared:read' }]);
      const [error] = registerChannel({ owner: EXTENSION, name: 'clash', permission: 'code:registered:read' });
      expect(error === null, 'registration itself should succeed');
      registered.push(`${EXTENSION}:clash`);

      const config = await resolveChannel(`${EXTENSION}:clash`);
      expect(config.source === 'code' && config.permission === 'code:registered:read', `the registration should win, got ${JSON.stringify(config)}`);
    } finally {
      cleanupRegistered();
      await purge();
    }
    pass('precedence');
  },

  'a permission gates a channel: members are in, outsiders are out': async ({ pass }) => {
    await purge();
    try {
      const [memberError, member] = await createUser({ ...MEMBER, emailVerified: true });
      expect(!memberError, `could not create member: ${memberError?.msg}`);
      const [outsiderError, outsider] = await createUser({ ...OUTSIDER, emailVerified: true });
      expect(!outsiderError, `could not create outsider: ${outsiderError?.msg}`);

      const [permError] = await createPermission({ resource: 'feed', action: 'read', description: 'test', owner: 'realtime-channels-test' });
      expect(!permError, `could not create permission: ${permError?.msg}`);
      const [groupError] = await createGroup({ name: GROUP, description: 'test', owner: 'realtime-channels-test' });
      expect(!groupError, `could not create group: ${groupError?.msg}`);
      expect(!(await addPermissionToGroup(GROUP, PERMISSION))[0], 'could not grant the permission to the group');
      expect(!(await addUserToGroup(member.user.id, GROUP))[0], 'could not add the member to the group');

      const [, channel] = register({ name: 'feed', permission: PERMISSION });
      const config = await resolveChannel(channel.channel);

      const [, memberAllowed] = await authorizeSubscription({ config, user: member.user });
      expect(memberAllowed === true, 'a member of the group should be allowed');

      const [, outsiderAllowed] = await authorizeSubscription({ config, user: outsider.user });
      expect(outsiderAllowed === false, 'a user without the permission must be refused');
    } finally {
      cleanupRegistered();
      await purge();
    }
    pass('permission gating');
  },

  'a declared channel carries its scope, handler path and drop policy, and anything unusable closes it': async ({ pass }) => {
    await purge();
    try {
      await declareExtension([
        { name: 'world', permission: 'ext:world:read', scope: 'process', onMessage: './handlers/world.js', dropIfBackedUp: true },
        { name: 'plain', permission: 'ext:plain:read' },
        { name: 'process-persist', permission: 'ext:x:read', scope: 'process', persist: true },
        { name: 'bad-scope', permission: 'ext:x:read', scope: 'galaxy' },
        { name: 'escape', permission: 'ext:x:read', onMessage: '../../../../etc/passwd' },
        { name: 'nested-escape', permission: 'ext:x:read', onMessage: './../../other/handler.js' },
        { name: 'absolute', permission: 'ext:x:read', onMessage: '/etc/passwd' },
        { name: 'bare', permission: 'ext:x:read', onMessage: 'handlers/world.js' },
        { name: 'not-a-string', permission: 'ext:x:read', onMessage: 5 }
      ]);

      const world = await resolveChannel(`${EXTENSION}:world`);
      expect(world?.scope === 'process' && world.dropIfBackedUp === true, `unexpected world config ${JSON.stringify(world)}`);
      const expectedPath = path.join(process.cwd(), 'node_modules', EXTENSION, 'handlers', 'world.js');
      expect(world.handlerPath === expectedPath, `the handler path should be inside the package, got ${world.handlerPath}`);

      const plain = await resolveChannel(`${EXTENSION}:plain`);
      expect(plain.scope === 'cluster' && plain.handlerPath === null && plain.dropIfBackedUp === false, 'a plain declaration keeps the defaults');

      for(const name of ['process-persist', 'bad-scope', 'escape', 'nested-escape', 'absolute', 'bare', 'not-a-string']){
        expect(await resolveChannel(`${EXTENSION}:${name}`) === null, `"${name}" cannot be honoured as declared, so the channel must stay closed rather than open with other behaviour`);
      }
    } finally {
      await purge();
    }
    pass('declared options');
  },

  'an extension\'s handler is loaded from its own package, once, and a broken one is reported': async ({ pass }) => {
    await purge();
    const packageDir = path.join(process.cwd(), 'node_modules', EXTENSION);
    try {
      await mkdir(path.join(packageDir, 'handlers'), { recursive: true });
      await writeFile(path.join(packageDir, 'handlers', 'good.js'), 'export default async ({ data }) => ({ echoed: data });\n');
      await writeFile(path.join(packageDir, 'handlers', 'not-a-function.js'), 'export default { nope: true };\n');
      await writeFile(path.join(packageDir, 'handlers', 'broken.js'), 'this is not javascript (\n');

      await declareExtension([
        { name: 'good', permission: 'ext:x:read', onMessage: './handlers/good.js' },
        { name: 'not-a-function', permission: 'ext:x:read', onMessage: './handlers/not-a-function.js' },
        { name: 'broken', permission: 'ext:x:read', onMessage: './handlers/broken.js' },
        { name: 'missing', permission: 'ext:x:read', onMessage: './handlers/missing.js' }
      ]);
      clearMessageHandlerCache();

      const good = await loadMessageHandler(await resolveChannel(`${EXTENSION}:good`));
      expect(typeof good === 'function' && (await good({ data: 7 })).echoed === 7, 'the declared handler should load and run');
      expect(await loadMessageHandler(await resolveChannel(`${EXTENSION}:good`)) === good, 'it should be loaded once and kept, not re-imported per message');

      for(const name of ['not-a-function', 'broken', 'missing']){
        let failure = null;
        try { await loadMessageHandler(await resolveChannel(`${EXTENSION}:${name}`)); } catch(error) { failure = error; }
        expect(failure, `"${name}" should throw so the caller can report it, not be mistaken for "no handler"`);
      }
    } finally {
      clearMessageHandlerCache();
      await rm(packageDir, { recursive: true, force: true }).catch(() => {});
      await purge();
    }
    pass('handler loading');
  },

  'a permission and an authorize function must both agree': async ({ pass }) => {
    await purge();
    try {
      const [, memberResult] = await createUser({ ...MEMBER, emailVerified: true });
      await createPermission({ resource: 'feed', action: 'read', description: 'test', owner: 'realtime-channels-test' });
      await createGroup({ name: GROUP, description: 'test', owner: 'realtime-channels-test' });
      await addPermissionToGroup(GROUP, PERMISSION);
      await addUserToGroup(memberResult.user.id, GROUP);

      const [, vetoed] = register({ name: 'both-veto', permission: PERMISSION, authorize: () => false });
      const [, passed] = register({ name: 'both-pass', permission: PERMISSION, authorize: () => true });

      expect((await authorizeSubscription({ config: await resolveChannel(vetoed.channel), user: memberResult.user }))[1] === false, 'the authorize function should be able to veto a permitted user');
      expect((await authorizeSubscription({ config: await resolveChannel(passed.channel), user: memberResult.user }))[1] === true, 'both agreeing should allow');
    } finally {
      cleanupRegistered();
      await purge();
    }
    pass('permission and authorize combined');
  }
});

export default databaseReachable
  ? { ...pureTests, ...databaseTests() }
  : { ...pureTests, 'realtime channels, database part (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
