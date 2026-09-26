import { mkdir, mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import postgres from 'postgres';
import { sql, eq, like } from 'drizzle-orm';
import db from '../server/db/index.js';
import { realtimeMessage, realtimeChannel, session, user, hook, extension, group, groupPermission, permission, userGroup } from '../server/db/schema.js';
import createUser from '../server/utils/users/createUser.js';
import createSession from '../server/utils/sessions/createSession.js';
import createGroup from '../server/utils/groups/createGroup.js';
import createPermission from '../server/utils/permissions/createPermission.js';
import addPermissionToGroup from '../server/utils/permissions/addPermissionToGroup.js';
import addUserToGroup from '../server/utils/groups/addUserToGroup.js';
import { invalidateScopeCache } from '../server/utils/extensions/scopeCache.js';
import Hub from '../server/utils/realtime/Hub.js';
import getHub from '../server/utils/realtime/getHub.js';
import createHook from '../server/utils/hooks/createHook.js';
import { clearHandlerCache } from '../server/utils/hooks/triggerHook.js';
import { realtime } from '../server/sdk.js';
import publish from '../server/utils/realtime/publish.js';
import pruneMessages from '../server/utils/realtime/pruneMessages.js';
import { registerChannel, unregisterChannel, clearMessageHandlerCache } from '../server/utils/realtime/channels.js';
import { BUS_CHANNEL } from '../server/utils/realtime/constants.js';

/*
  The realtime hub against a real Postgres.

  Two Hub instances stand in for two kempo processes: each has its own subscribers and its own LISTEN
  connection, and the only thing joining them is the database, exactly as it is between real processes.
  That is what makes a publish through one reaching a subscriber held by the other a meaningful check.

  Needs a reachable Postgres with kempo's schema applied. When there is none the suite is replaced by a
  single "(SKIPPED)" entry so `npm test` still runs; check for that name before believing a green run.
*/

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const OWNER = 'realtime-hub-test';
const USER_EMAIL = 'realtime-hub-user@test.local';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const until = async (condition, description, timeout = 4000) => {
  const deadline = Date.now() + timeout;
  while(Date.now() < deadline){
    if(await condition()) return;
    await wait(10);
  }
  throw new Error(`timed out waiting for ${description}`);
};

const HOOK_LOG = Symbol.for('kempo.test.realtime.hooks');
const WARM_FLAG = Symbol.for('kempo.test.realtime.warm');
const PACKAGE_DIR = path.join(process.cwd(), 'node_modules', 'realtime-hub-test');
const WARM_GROUP = 'realtime-hub-test:Warmers';
const WARM_PERMISSION = 'realtime-hub-test:warm:read';
const SINGLETON = Symbol.for('kempo.realtime.hub');
const state = { hubs: [], errors: [], channels: [], hookDirs: [], observer: null };

const makeHub = (options = {}) => {
  const hub = new Hub({
    databaseUrl: process.env.DATABASE_URL,
    sessionCheckMs: 100000,
    pruneMs: 100000000,
    log: { error: message => state.errors.push(message) },
    ...options
  });
  state.hubs.push(hub);
  return hub;
};

const channel = (name, options = {}) => {
  const [error, result] = registerChannel({ owner: OWNER, name, authorize: () => true, ...options });
  expect(error === null, `could not register ${name}: ${error?.msg}`);
  state.channels.push(result.channel);
  return result.channel;
};

let userCounter = 0;

/*
  A stand-in for one open socket: it records every frame the hub delivers and how it was closed.
*/
const connect = (hub, { userId = `hub-test-user-${++userCounter}`, token = `hub-test-token-${userCounter}` } = {}) => {
  const client = { userId, frames: [], deliveries: [], closed: null, behind: false };
  const [error, added] = hub.addSubscriber({
    token,
    user: { id: userId, name: userId, email: `${userId}@test.local` },
    path: '/test',
    // A client that is behind refuses a delivery that opted in to being dropped, as a real socket does
    deliver: (frame, options) => {
      if(client.behind && options?.dropIfBackedUp) return false;
      client.frames.push(frame);
      client.deliveries.push({ frame, options });
      return true;
    },
    close: (code, reason) => { client.closed = { code, reason }; }
  });
  expect(error === null, `could not add a subscriber: ${error?.msg}`);
  client.id = added.id;
  client.hub = hub;
  client.messages = channelName => client.frames.filter(frame => frame.type === 'message' && (!channelName || frame.channel === channelName));
  client.types = () => client.frames.map(frame => frame.type);
  return client;
};

const subscribe = async (hub, client, channelName, since) => {
  const [error] = await hub.subscribe({ id: client.id, channel: channelName, since });
  expect(error === null, `subscribe to ${channelName} failed: ${error?.code} ${error?.msg}`);
};

const publishOne = async (channelName, data) => {
  const [error, result] = await publish({ channel: channelName, data });
  expect(error === null, `publish failed: ${error?.code} ${error?.msg}`);
  return result;
};

const cleanup = async () => {
  for(const hub of state.hubs.splice(0)) await hub.close();
  if(globalThis[SINGLETON]){
    await globalThis[SINGLETON].close();
    delete globalThis[SINGLETON];
  }
  if(state.observer){
    await state.observer.end({ timeout: 1 }).catch(() => {});
    state.observer = null;
  }
  await db.delete(hook).where(eq(hook.owner, OWNER)).catch(() => {});
  clearHandlerCache();
  for(const dir of state.hookDirs.splice(0)) await rm(dir, { recursive: true, force: true }).catch(() => {});
  delete globalThis[HOOK_LOG];
  delete globalThis[WARM_FLAG];
  await rm(PACKAGE_DIR, { recursive: true, force: true }).catch(() => {});
  await db.delete(extension).where(eq(extension.name, OWNER)).catch(() => {});
  invalidateScopeCache();
  clearMessageHandlerCache();
  await db.delete(groupPermission).where(eq(groupPermission.groupName, WARM_GROUP)).catch(() => {});
  await db.delete(group).where(eq(group.name, WARM_GROUP)).catch(() => {});
  await db.delete(permission).where(eq(permission.name, WARM_PERMISSION)).catch(() => {});
  for(const name of state.channels.splice(0)) unregisterChannel(name);
  await db.delete(realtimeMessage).where(like(realtimeMessage.channel, `${OWNER}:%`)).catch(() => {});
  await db.delete(realtimeChannel).where(like(realtimeChannel.channel, `${OWNER}:%`)).catch(() => {});
  const [row] = await db.select().from(user).where(eq(user.email, USER_EMAIL));
  if(row){
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
};

const withCleanup = async (test) => {
  await cleanup();
  state.errors = [];
  try {
    await test();
    expect(state.errors.length === 0, `the hub logged errors: ${state.errors.join(' | ')}`);
  } finally {
    await cleanup();
  }
};

/*
  Real hooks, through kempo's hook system: a row in the hook table naming a handler file. Each handler
  records what it was given, so a test can see exactly what an extension would receive.
*/
const installHooks = async (events, { slowMs = 0, guard = false } = {}) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kempo-realtime-hooks-'));
  state.hookDirs.push(dir);
  globalThis[HOOK_LOG] = [];

  for(const event of events){
    const file = path.join(dir, `${event.replace(/[^a-z_]/g, '-')}.js`);
    const lines = [];
    if(slowMs) lines.push(`await new Promise(resolve => setTimeout(resolve, ${slowMs}));`);
    if(guard){
      lines.push("if(data.channel.endsWith(':guarded')) throw { code: 451, msg: 'Not today' };");
      lines.push("if(data.channel.endsWith(':explodes')) throw new Error('secret internal detail');");
    }
    lines.push(`(globalThis[Symbol.for('kempo.test.realtime.hooks')] ||= []).push({ event: ${JSON.stringify(event)}, ...data });`);
    await writeFile(file, `export default async (data) => {\n  ${lines.join('\n  ')}\n};\n`);

    const [error] = await createHook({ owner: OWNER, event, callback: file });
    expect(error === null, `could not create the ${event} hook: ${error?.msg}`);
  }
};

const hookLog = () => globalThis[HOOK_LOG] || [];

const tests = () => ({
  'a publish on one process reaches subscribers held by another': async ({ pass }) => {
    await withCleanup(async () => {
      const live = channel('live');
      const hubA = makeHub();
      const hubB = makeHub();
      const a = connect(hubA);
      const b = connect(hubB);

      await subscribe(hubA, a, live);
      await subscribe(hubB, b, live);
      await publishOne(live, { n: 1 });

      await until(() => a.messages().length === 1 && b.messages().length === 1, 'both hubs to deliver');
      expect(a.messages()[0].data.n === 1 && b.messages()[0].data.n === 1, 'the payload should arrive intact');
      expect(!('id' in a.messages()[0]), 'a channel that does not persist has no message id');
      expect(a.types()[0] === 'subscribed', 'the first frame should confirm the subscription');
    });
    pass('cross-process delivery');
  },

  'subscribing is refused for a closed, unknown or someone else\'s channel': async ({ pass }) => {
    await withCleanup(async () => {
      const denied = channel('denied', { authorize: () => false });
      const hub = makeHub();
      const client = connect(hub);

      const [deniedError] = await hub.subscribe({ id: client.id, channel: denied });
      expect(deniedError?.code === 403, `a channel whose authorize says no should be a 403, got ${JSON.stringify(deniedError)}`);

      const [unknownError] = await hub.subscribe({ id: client.id, channel: `${OWNER}:does-not-exist` });
      expect(unknownError?.code === 404, `an unknown channel should be a 404, got ${JSON.stringify(unknownError)}`);

      const [otherError] = await hub.subscribe({ id: client.id, channel: 'user:someone-else' });
      expect(otherError?.code === 403, `another user's channel should be a 403, got ${JSON.stringify(otherError)}`);

      expect(client.messages().length === 0 && !client.types().includes('subscribed'), 'a refused subscription must not confirm or deliver anything');
      expect(hub.listConnections()[1].channels.length === 0, 'a refused subscription must not register the channel');
    });
    pass('refusals');
  },

  'a user\'s own channel delivers to them and to no one else': async ({ pass }) => {
    await withCleanup(async () => {
      const hub = makeHub();
      const me = connect(hub, { userId: 'hub-test-me' });
      const other = connect(hub, { userId: 'hub-test-other' });

      await subscribe(hub, me, 'user:hub-test-me');
      const [, refused] = [null, await hub.subscribe({ id: other.id, channel: 'user:hub-test-me' })];
      expect(refused[0]?.code === 403, 'another user must not subscribe to my channel');

      await publishOne('user:hub-test-me', { hello: 'me' });
      await until(() => me.messages().length === 1, 'my message');
      await wait(100);
      expect(me.messages()[0].data.hello === 'me', 'the payload should arrive');
      expect(other.messages().length === 0, 'the other user must receive nothing');
    });
    pass('user channel');
  },

  'a persisted channel numbers its messages and delivers the same ids on every process': async ({ pass }) => {
    await withCleanup(async () => {
      const log = channel('log', { persist: true });
      const hubA = makeHub();
      const hubB = makeHub();
      const a = connect(hubA);
      const b = connect(hubB);
      await subscribe(hubA, a, log);
      await subscribe(hubB, b, log);

      const published = [];
      for(const n of [1, 2, 3]) published.push((await publishOne(log, { n })).id);

      await until(() => a.messages().length === 3 && b.messages().length === 3, 'three messages on each hub');
      const idsA = a.messages().map(m => m.id);
      const idsB = b.messages().map(m => m.id);
      expect(JSON.stringify(idsA) === JSON.stringify(published), `hub A saw ids ${idsA}, published ${published}`);
      expect(JSON.stringify(idsB) === JSON.stringify(published), `hub B saw ids ${idsB}, published ${published}`);
      expect(published[0] < published[1] && published[1] < published[2], 'ids should ascend');
      expect(a.messages().map(m => m.data.n).join() === '1,2,3', 'data should be read back from the row in order');
    });
    pass('persisted delivery');
  },

  'subscribing with since replays what was missed, in order, then continues live': async ({ pass }) => {
    await withCleanup(async () => {
      const log = channel('replay', { persist: true });
      const hub = makeHub();

      const ids = [];
      for(const n of [1, 2, 3, 4, 5]) ids.push((await publishOne(log, { n })).id);

      const client = connect(hub);
      await subscribe(hub, client, log, ids[1]);
      await until(() => client.messages().length === 3, 'the backlog');
      expect(client.messages().map(m => m.data.n).join() === '3,4,5', `expected 3,4,5, got ${client.messages().map(m => m.data.n)}`);
      expect(client.messages().map(m => m.id).join() === ids.slice(2).join(), 'replayed ids should match');

      const live = await publishOne(log, { n: 6 });
      await until(() => client.messages().length === 4, 'the live message after replay');
      expect(client.messages()[3].id === live.id && client.messages()[3].data.n === 6, 'the live message should follow the backlog');
      await wait(150);
      expect(client.messages().length === 4, 'nothing should be delivered twice');
      expect(!client.types().includes('gap'), 'nothing was pruned, so there is no gap');
    });
    pass('replay');
  },

  'replay never loses or repeats a message published while the subscription is being set up': async ({ pass }) => {
    /*
      The boundary between "read the backlog" and "go live" is where a gap or a duplicate would appear, and
      whether it does depends on exact timing, so the subscribe is started at a range of offsets into a
      burst of publishes. Each round must see every message after `since` exactly once, in order.
    */
    for(const offset of [0, 1, 3, 6, 10, 15, 25, 40]){
      await withCleanup(async () => {
        const log = channel(`race-${offset}`, { persist: true });
        const hub = makeHub();
        const first = await publishOne(log, { n: 0 });

        const published = [];
        const publisher = (async () => {
          for(let n = 1; n <= 50; n++) published.push((await publishOne(log, { n })).id);
        })();

        await wait(offset);
        const client = connect(hub);
        await subscribe(hub, client, log, first.id);
        await publisher;

        await until(() => client.messages().length >= published.length, `all ${published.length} messages (offset ${offset}ms)`, 8000);
        await wait(150);

        const received = client.messages().map(m => m.id);
        expect(received.length === published.length, `offset ${offset}ms: received ${received.length}, published ${published.length}`);
        expect(JSON.stringify(received) === JSON.stringify(published), `offset ${offset}ms: received ids differ from published ids`);
        expect(received.every((id, index) => index === 0 || id > received[index - 1]), `offset ${offset}ms: ids were not strictly ascending, so something repeated or reordered`);
      });
    }
    pass('backlog/live boundary');
  },

  'concurrent publishes on one channel are delivered in id order with none dropped': async ({ pass }) => {
    await withCleanup(async () => {
      const log = channel('concurrent', { persist: true });
      const hub = makeHub();
      const client = connect(hub);
      await subscribe(hub, client, log);

      // Thirty publishes racing. If two could commit out of id order, the later id would be delivered first
      // and the earlier one then look like a duplicate and be dropped, so a dropped message is the symptom.
      const results = await Promise.all(Array.from({ length: 30 }, (_, n) => publishOne(log, { n })));
      const published = results.map(r => r.id).sort((x, y) => x - y);

      await until(() => client.messages().length === 30, 'thirty messages');
      await wait(100);
      const received = client.messages().map(m => m.id);
      expect(received.length === 30, `received ${received.length} of 30`);
      expect(JSON.stringify(received) === JSON.stringify(published), 'ids should arrive in ascending order');
    });
    pass('ordering under concurrency');
  },

  'a subscriber whose since is older than what was pruned is told it missed messages': async ({ pass }) => {
    await withCleanup(async () => {
      const log = channel('gap', { persist: true, retention: '1h' });
      const hub = makeHub();
      const ids = [];
      for(const n of [1, 2, 3]) ids.push((await publishOne(log, { n })).id);

      const [pruneError, pruned] = await pruneMessages({ now: new Date(Date.now() + 2 * 60 * 60 * 1000) });
      expect(pruneError === null && pruned.deleted >= 3, `prune should delete the expired rows, got ${JSON.stringify([pruneError, pruned])}`);
      const [mark] = await db.select().from(realtimeChannel).where(eq(realtimeChannel.channel, log));
      expect(mark?.prunedThrough === ids[2], `the watermark should be the highest pruned id ${ids[2]}, got ${mark?.prunedThrough}`);

      const behind = connect(hub);
      await subscribe(hub, behind, log, ids[0]);
      expect(behind.types().includes('gap'), 'a since below the watermark must produce a gap frame');
      expect(behind.messages().length === 0, 'the pruned messages are gone, so none are replayed');

      const caughtUp = connect(hub);
      await subscribe(hub, caughtUp, log, ids[2]);
      expect(!caughtUp.types().includes('gap'), 'a since at the watermark has missed nothing');

      const fresh = await publishOne(log, { n: 4 });
      await until(() => behind.messages().length === 1 && caughtUp.messages().length === 1, 'the new message on both');
      expect(behind.messages()[0].id === fresh.id, 'live delivery should continue after a gap');
    });
    pass('gap detection');
  },

  'pruning removes only expired rows, and gives an unregistered channel the default retention': async ({ pass }) => {
    await withCleanup(async () => {
      const kept = channel('retention', { persist: true, retention: '1h' });
      const orphan = `${OWNER}:orphan`;
      const hoursAgo = hours => new Date(Date.now() - hours * 3600 * 1000);

      await db.insert(realtimeMessage).values([
        { channel: kept, data: { age: '3h' }, createdAt: hoursAgo(3) },
        { channel: kept, data: { age: '10m' }, createdAt: hoursAgo(1 / 6) },
        { channel: orphan, data: { age: '25h' }, createdAt: hoursAgo(25) },
        { channel: orphan, data: { age: '2h' }, createdAt: hoursAgo(2) }
      ]);

      const [error, result] = await pruneMessages();
      expect(error === null && result.deleted === 2, `expected to delete 2 rows, got ${JSON.stringify([error, result])}`);

      const remaining = await db.select().from(realtimeMessage).where(like(realtimeMessage.channel, `${OWNER}:%`));
      const ages = remaining.map(row => row.data.age).sort();
      expect(JSON.stringify(ages) === JSON.stringify(['10m', '2h']), `only unexpired rows should remain, got ${ages}`);
    });
    pass('retention');
  },

  'message size limits are enforced with a clear error, and bad data is refused': async ({ pass }) => {
    await withCleanup(async () => {
      const live = channel('size-live');
      const log = channel('size-log', { persist: true });
      const hub = makeHub();
      const client = connect(hub);
      await subscribe(hub, client, live);
      await subscribe(hub, client, log);

      const [tooBigError] = await publish({ channel: live, data: 'x'.repeat(8000) });
      expect(tooBigError?.code === 413 && /persist/.test(tooBigError.msg), `an oversized non-persisted message should be a 413 that mentions persist, got ${JSON.stringify(tooBigError)}`);

      await publishOne(live, 'y'.repeat(7000));
      await publishOne(log, 'z'.repeat(100000));
      await until(() => client.messages().length === 2, 'the two allowed messages');
      expect(client.messages(live)[0].data.length === 7000, 'a message under the limit should arrive whole');
      expect(client.messages(log)[0].data.length === 100000, 'a persisted message is not limited by NOTIFY, so 100KB should arrive whole');

      const [hugeError] = await publish({ channel: log, data: 'q'.repeat(1100000) });
      expect(hugeError?.code === 413, `a message over the persisted limit should be a 413, got ${JSON.stringify(hugeError)}`);

      const circular = {};
      circular.self = circular;
      for(const [label, data] of [['circular', circular], ['bigint', 10n], ['undefined', undefined], ['null', null]]){
        const [error] = await publish({ channel: live, data });
        expect(error?.code === 400, `${label} data should be a 400, got ${JSON.stringify(error)}`);
      }

      const [unknownError] = await publish({ channel: `${OWNER}:never-registered`, data: 1 });
      expect(unknownError?.code === 404, `publishing to an unregistered channel should be a 404, got ${JSON.stringify(unknownError)}`);
      const [missingError] = await publish({ data: 1 });
      expect(missingError?.code === 400, 'a missing channel should be a 400');
    });
    pass('limits and validation');
  },

  'unsubscribing stops delivery and removing a subscriber cleans up after it': async ({ pass }) => {
    await withCleanup(async () => {
      const live = channel('unsub');
      const hub = makeHub();
      const stays = connect(hub);
      const leaves = connect(hub);
      await subscribe(hub, stays, live);
      await subscribe(hub, leaves, live);

      expect(hub.listConnections()[1].channels[0].subscribers === 2, 'both should be counted');
      hub.unsubscribe({ id: leaves.id, channel: live });
      await publishOne(live, { n: 1 });
      await until(() => stays.messages().length === 1, 'the remaining subscriber');
      await wait(100);
      expect(leaves.messages().length === 0, 'an unsubscribed subscriber must receive nothing');

      hub.removeSubscriber({ id: stays.id });
      const [, summary] = hub.listConnections();
      expect(summary.channels.length === 0, 'a channel with no subscribers should disappear');
      expect(summary.connections.length === 1 && summary.connections[0].id === leaves.id, 'only the other connection should remain');
      expect(hub.removeSubscriber({ id: 'never-existed' })[1].removed === false, 'removing an unknown subscriber is harmless');
    });
    pass('unsubscribe and remove');
  },

  'subscribing twice is harmless and bad arguments are rejected': async ({ pass }) => {
    await withCleanup(async () => {
      const live = channel('idempotent');
      const hub = makeHub();
      const client = connect(hub);

      await subscribe(hub, client, live);
      await subscribe(hub, client, live);
      expect(client.types().filter(type => type === 'subscribed').length === 1, 'a repeated subscribe must not confirm twice');

      await publishOne(live, { n: 1 });
      await until(() => client.messages().length === 1, 'the message');
      await wait(100);
      expect(client.messages().length === 1, 'a repeated subscribe must not duplicate delivery');

      expect((await hub.subscribe({ id: 'nobody', channel: live }))[0].code === 404, 'an unknown subscriber is a 404');
      expect((await hub.subscribe({ id: client.id }))[0].code === 400, 'a missing channel is a 400');
      for(const since of [-1, 1.5, 'x']){
        expect((await hub.subscribe({ id: client.id, channel: live + '-other', since }))[0].code === 400, `since ${JSON.stringify(since)} is a 400`);
      }

      expect(hub.addSubscriber({ user: { id: 'u' }, deliver: () => {}, close: () => {} })[0].code === 401, 'no token is a 401');
      expect(hub.addSubscriber({ token: 't', user: { id: 'u' } })[0].code === 400, 'no deliver/close is a 400');
    });
    pass('idempotence and validation');
  },

  'a socket is closed when its session ends, and one with a live session is left alone': async ({ pass }) => {
    await withCleanup(async () => {
      const [userError, created] = await createUser({ name: 'Realtime Hub', email: USER_EMAIL, password: 'RealtimeHub123!', emailVerified: true });
      expect(!userError, `could not create a user: ${userError?.msg}`);
      const [sessionError, kept] = await createSession(created.user.id);
      const [, revoked] = await createSession(created.user.id);
      expect(!sessionError, 'could not create a session');

      const hub = makeHub({ sessionCheckMs: 100 });
      const staying = connect(hub, { userId: created.user.id, token: kept.sessionToken });
      const leaving = connect(hub, { userId: created.user.id, token: revoked.sessionToken });

      await wait(350);
      expect(staying.closed === null && leaving.closed === null, 'a valid session must not be closed');

      await db.delete(session).where(eq(session.token, revoked.sessionToken));
      await until(() => leaving.closed !== null, 'the revoked socket to be closed');
      expect(leaving.closed.code === 4401, `expected close code 4401, got ${leaving.closed.code}`);

      await wait(350);
      expect(staying.closed === null, 'the socket with a live session must be unaffected by another session ending');
      const [, summary] = hub.listConnections();
      expect(summary.connections.length === 1 && summary.connections[0].id === staying.id, 'the closed socket should be removed from the hub');
    });
    pass('session revocation');
  },

  'the listening connection recovers from being killed, and persisted messages are not lost': async ({ pass }) => {
    await withCleanup(async () => {
      const log = channel('recover', { persist: true });
      const live = channel('recover-live');
      const hub = makeHub();
      const client = connect(hub);

      const first = await publishOne(log, { n: 0 });
      await subscribe(hub, client, log, first.id - 1);
      await subscribe(hub, client, live);
      await until(() => client.messages(log).length === 1, 'the first message');

      const listenPids = async () => (await db.execute(sql`select pid from pg_stat_activity where query ilike ${'listen %' + BUS_CHANNEL + '%'} and pid <> pg_backend_pid()`)).map(row => row.pid);
      const before = await listenPids();
      expect(before.length === 1, `expected one listening backend, found ${before.length}`);

      await db.execute(sql`select pg_terminate_backend(${before[0]})`);

      // Published straight after the kill, while the hub may still be reconnecting
      const during = [];
      for(const n of [1, 2, 3]) during.push((await publishOne(log, { n })).id);

      await until(async () => (await listenPids()).length === 1 && (await listenPids())[0] !== before[0], 'a new listening backend');
      await until(() => client.messages(log).length === 4, 'every persisted message, including those published during the outage');
      await wait(200);

      const ids = client.messages(log).map(m => m.id);
      expect(JSON.stringify(ids) === JSON.stringify([first.id, ...during]), `expected ${[first.id, ...during]}, got ${ids}: lost or duplicated`);

      await publishOne(live, { after: 'reconnect' });
      await until(() => client.messages(live).length === 1, 'a message on a channel that does not persist, after reconnecting');
    });
    pass('reconnect');
  },

  'a hub that cannot reach the database reports it instead of throwing': async ({ pass }) => {
    await withCleanup(async () => {
      const live = channel('unreachable');
      const hub = makeHub({ databaseUrl: 'postgresql://nobody:nothing@127.0.0.1:1/none' });
      const client = connect(hub);

      const outcome = await Promise.race([
        hub.subscribe({ id: client.id, channel: live }),
        wait(6000).then(() => 'hung')
      ]);
      expect(outcome !== 'hung', 'subscribe should fail promptly when the database cannot be reached');
      expect(outcome[0]?.code === 503, `expected a 503, got ${JSON.stringify(outcome)}`);
      state.errors = [];
    });
    pass('unreachable database');
  },

  'the hub lists connections for the admin view': async ({ pass }) => {
    await withCleanup(async () => {
      const live = channel('listing');
      const hub = makeHub();
      const client = connect(hub, { userId: 'hub-test-lister' });
      await subscribe(hub, client, live);

      const [error, summary] = hub.listConnections();
      expect(error === null && summary.process === process.pid, 'should report this process');
      const [connection] = summary.connections;
      expect(connection.userId === 'hub-test-lister' && connection.path === '/test', `unexpected connection ${JSON.stringify(connection)}`);
      expect(JSON.stringify(connection.channels) === JSON.stringify([live]), 'should list the channels it is subscribed to');
      expect(connection.connectedAt instanceof Date && connection.lastActivity instanceof Date, 'should carry timestamps');
      expect(!('token' in connection), 'a session token must never be exposed');
    });
    pass('listing');
  },

  'lifecycle hooks fire with the right payloads and never expose the session token': async ({ pass }) => {
    await withCleanup(async () => {
      await installHooks(['realtime:connected', 'realtime:subscribed', 'realtime:unsubscribed', 'realtime:disconnected']);
      const room = channel('hooked');
      const hub = makeHub();

      const client = connect(hub, { userId: 'hooks-user', token: 'hooks-secret-token' });
      await until(() => hookLog().some(e => e.event === 'realtime:connected'), 'the connected hook');

      await subscribe(hub, client, room);
      await until(() => hookLog().some(e => e.event === 'realtime:subscribed'), 'the subscribed hook');

      hub.unsubscribe({ id: client.id, channel: room });
      await subscribe(hub, client, room);
      hub.removeSubscriber({ id: client.id, reason: 1006 });
      await until(() => hookLog().some(e => e.event === 'realtime:disconnected'), 'the disconnected hook');
      await until(() => hookLog().filter(e => e.event === 'realtime:unsubscribed').length === 2, 'both unsubscribed hooks');

      const by = event => hookLog().filter(e => e.event === event);
      expect(by('realtime:connected')[0].userId === 'hooks-user' && by('realtime:connected')[0].connectionId === client.id && by('realtime:connected')[0].path === '/test', `connected payload: ${JSON.stringify(by('realtime:connected')[0])}`);
      expect(by('realtime:subscribed').length === 2 && by('realtime:subscribed')[0].channel === room, 'each subscription should fire a hook');
      const reasons = by('realtime:unsubscribed').map(e => e.reason).sort();
      expect(JSON.stringify(reasons) === JSON.stringify(['client', 'disconnect']), `an explicit unsubscribe and a disconnect should say why, got ${reasons}`);
      const gone = by('realtime:disconnected')[0];
      expect(gone.reason === 1006 && JSON.stringify(gone.channels) === JSON.stringify([room]), `disconnected payload: ${JSON.stringify(gone)}`);
      expect(!JSON.stringify(hookLog()).includes('hooks-secret-token'), 'a session token must never reach a hook');
    });
    pass('lifecycle hooks');
  },

  'a slow hook cannot hold up a connection': async ({ pass }) => {
    await withCleanup(async () => {
      await installHooks(['realtime:connected', 'realtime:subscribed', 'realtime:disconnected'], { slowMs: 800 });
      const room = channel('slow-hooks');
      const hub = makeHub();

      const started = Date.now();
      const client = connect(hub);
      await subscribe(hub, client, room);
      hub.removeSubscriber({ id: client.id });
      const elapsed = Date.now() - started;

      expect(elapsed < 400, `three hooks that each take 800ms must not delay the connection, it took ${elapsed}ms`);
      expect(hookLog().length === 0, 'the hooks should still be running in the background');
      await until(() => hookLog().length === 3, 'the slow hooks to finish anyway', 6000);
    });
    pass('non-blocking hooks');
  },

  'before_subscribe can refuse with a chosen code, and an unexpected failure is refused without saying why': async ({ pass }) => {
    await withCleanup(async () => {
      await installHooks(['realtime:before_subscribe'], { guard: true });
      const open = channel('open');
      const guarded = channel('guarded');
      const explodes = channel('explodes');
      const hub = makeHub();
      const client = connect(hub);

      await subscribe(hub, client, open);
      const seen = hookLog().find(e => e.event === 'realtime:before_subscribe' && e.channel === open);
      expect(seen && seen.userId === client.userId && seen.user.id === client.userId && seen.connectionId === client.id, `the guard should be told who and what, got ${JSON.stringify(seen)}`);

      const [refused] = await hub.subscribe({ id: client.id, channel: guarded });
      expect(refused?.code === 451 && refused.msg === 'Not today', `a handler's own { code, msg } should come back as given, got ${JSON.stringify(refused)}`);

      const [failed] = await hub.subscribe({ id: client.id, channel: explodes });
      expect(failed?.code === 403 && failed.msg === 'Subscription refused', `an unexpected failure should be a plain 403, got ${JSON.stringify(failed)}`);
      expect(!JSON.stringify(failed).includes('secret'), 'the reason for an unexpected failure must not reach the client');
      expect(state.errors.some(message => message.includes('secret internal detail')), 'but it must be logged for the operator');

      expect(!client.types().includes('subscribed') || client.frames.filter(f => f.type === 'subscribed').length === 1, 'a refused subscription must not confirm');
      expect(hub.listConnections()[1].channels.length === 1, 'only the allowed channel should be registered');
      state.errors = [];
    });
    pass('subscribe guard');
  },

  'a channel handler receives a subscribed client\'s message and its return value comes back': async ({ pass }) => {
    await withCleanup(async () => {
      const calls = [];
      const echo = channel('echo', { onMessage: async (args) => { calls.push(args); return { echoed: args.data }; } });
      const silent = channel('silent', { onMessage: async () => undefined });
      const deaf = channel('deaf');
      const hub = makeHub();
      const client = connect(hub, { userId: 'sender' });
      await subscribe(hub, client, echo);
      await subscribe(hub, client, silent);
      await subscribe(hub, client, deaf);

      const [error, result] = await hub.handleMessage({ id: client.id, channel: echo, data: { n: 1 } });
      expect(error === null && JSON.stringify(result) === JSON.stringify({ echoed: { n: 1 } }), `unexpected ${JSON.stringify([error, result])}`);
      expect(calls.length === 1 && calls[0].user.id === 'sender' && calls[0].channel === echo && calls[0].connectionId === client.id && calls[0].data.n === 1, `the handler should be told who sent what where, got ${JSON.stringify(calls[0])}`);
      expect(!('token' in calls[0]) && !('token' in calls[0].user), 'a handler is never given the session token');

      const [, nothing] = await hub.handleMessage({ id: client.id, channel: silent, data: 1 });
      expect(nothing === null, 'a handler that returns nothing acks null');

      const [notSubscribed] = await hub.handleMessage({ id: client.id, channel: channel('elsewhere', { onMessage: async () => 'x' }), data: 1 });
      expect(notSubscribed?.code === 403, `a client that is not subscribed must be refused, got ${JSON.stringify(notSubscribed)}`);

      const [noHandler] = await hub.handleMessage({ id: client.id, channel: deaf, data: 1 });
      expect(noHandler?.code === 405, `a channel with no handler accepts nothing, got ${JSON.stringify(noHandler)}`);

      const [unknown] = await hub.handleMessage({ id: 'nobody', channel: echo, data: 1 });
      expect(unknown?.code === 404, 'an unknown connection is a 404');
      expect(calls.length === 1, 'none of the refused messages may reach the handler');
    });
    pass('message handlers');
  },

  'a handler that throws tells the client something safe, and one that refuses on purpose is heard': async ({ pass }) => {
    await withCleanup(async () => {
      const boom = channel('boom', { onMessage: async () => { throw new Error('database password is hunter2'); } });
      const teapot = channel('teapot', { onMessage: async () => { throw { code: 418, msg: 'I am a teapot' }; } });
      const nonsense = channel('nonsense', { onMessage: async () => { throw { code: 200, msg: 'not an error' }; } });
      const hub = makeHub();
      const client = connect(hub);
      for(const name of [boom, teapot, nonsense]) await subscribe(hub, client, name);

      const [failure] = await hub.handleMessage({ id: client.id, channel: boom, data: 1 });
      expect(failure?.code === 500 && failure.msg === 'Message handler failed', `got ${JSON.stringify(failure)}`);
      expect(!JSON.stringify(failure).includes('hunter2'), 'an internal error message must never reach the client');
      expect(state.errors.some(message => message.includes('hunter2')), 'it must be logged for the operator');

      const [refused] = await hub.handleMessage({ id: client.id, channel: teapot, data: 1 });
      expect(refused?.code === 418 && refused.msg === 'I am a teapot', `a deliberate refusal should reach the client as given, got ${JSON.stringify(refused)}`);

      const [outOfRange] = await hub.handleMessage({ id: client.id, channel: nonsense, data: 1 });
      expect(outOfRange?.code === 500, `a "refusal" that is not an error status is treated as a bug, got ${JSON.stringify(outOfRange)}`);
      expect(client.closed === null, 'a failing handler must not close the connection');
      state.errors = [];
    });
    pass('handler errors');
  },

  'one connection\'s messages are handled strictly in order, and connections do not wait for each other': async ({ pass }) => {
    await withCleanup(async () => {
      const order = [];
      const ordered = channel('ordered', {
        onMessage: async ({ data, connectionId }) => {
          order.push(`start:${data.label}`);
          await wait(data.wait);
          order.push(`end:${data.label}`);
          return connectionId;
        }
      });
      const hub = makeHub();
      const a = connect(hub);
      const b = connect(hub);
      await subscribe(hub, a, ordered);
      await subscribe(hub, b, ordered);

      // Three messages from one connection issued back to back, the first slowest
      const first = hub.handleMessage({ id: a.id, channel: ordered, data: { label: 'a1', wait: 80 } });
      const second = hub.handleMessage({ id: a.id, channel: ordered, data: { label: 'a2', wait: 0 } });
      const third = hub.handleMessage({ id: a.id, channel: ordered, data: { label: 'a3', wait: 0 } });
      // ...and another connection's message, which must not queue behind them
      const other = hub.handleMessage({ id: b.id, channel: ordered, data: { label: 'b1', wait: 0 } });

      await other;
      expect(order.includes('end:b1') && !order.includes('end:a1'), `another connection must not wait for a slow handler, order was ${order}`);

      await Promise.all([first, second, third]);
      const mine = order.filter(entry => entry.includes(':a'));
      expect(JSON.stringify(mine) === JSON.stringify(['start:a1', 'end:a1', 'start:a2', 'end:a2', 'start:a3', 'end:a3']), `one connection's messages must run one at a time in order, got ${mine}`);
    });
    pass('ordering');
  },

  'a client that outpaces its handler is told so instead of building a queue': async ({ pass }) => {
    await withCleanup(async () => {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const slow = channel('slow', { onMessage: async () => { await gate; return 'done'; } });
      const hub = makeHub({ maxPendingMessages: 3 });
      const client = connect(hub);
      await subscribe(hub, client, slow);

      const results = Array.from({ length: 6 }, () => hub.handleMessage({ id: client.id, channel: slow, data: 1 }));
      const rejected = (await Promise.all(results.slice(3))).map(([error]) => error?.code);
      expect(JSON.stringify(rejected) === JSON.stringify([429, 429, 429]), `messages beyond the bound should be refused at once, got ${rejected}`);

      release();
      const accepted = (await Promise.all(results.slice(0, 3))).map(([error, value]) => error === null && value === 'done');
      expect(accepted.every(Boolean), 'the three that were accepted should complete normally');

      const [afterwards] = await hub.handleMessage({ id: client.id, channel: slow, data: 1 });
      expect(afterwards === null, 'once the queue drains, messages are accepted again');
    });
    pass('pending bound');
  },

  'sending too fast is refused, a burst is forgiven, and sustained abuse closes the connection': async ({ pass }) => {
    await withCleanup(async () => {
      const room = channel('rate', { onMessage: async () => 'ok' });
      const hub = makeHub({ maxMessagesPerSecond: 5, rateStrikes: 2 });
      const client = connect(hub);
      await subscribe(hub, client, room);

      const send = () => hub.handleMessage({ id: client.id, channel: room, data: 1 });

      // Window one: 8 messages at a limit of 5
      const first = await Promise.all(Array.from({ length: 8 }, send));
      const codes = first.map(([error]) => error?.code ?? 200);
      expect(codes.filter(code => code === 200).length === 5 && codes.filter(code => code === 429).length === 3, `5 should pass and 3 be refused, got ${codes}`);
      expect(client.closed === null, 'one burst over the limit must not close the connection');

      // A quiet window in between forgives it
      await wait(1100);
      await send();
      await wait(1100);

      const second = await Promise.all(Array.from({ length: 8 }, send));
      expect(second.filter(([error]) => error?.code === 429).length === 3, 'the limit applies afresh each window');
      expect(client.closed === null, 'a burst after a quiet window is still just a burst');

      // Now over the limit in two consecutive windows
      await wait(1100);
      await Promise.all(Array.from({ length: 8 }, send));
      await wait(1100);
      await Promise.all(Array.from({ length: 8 }, send));

      expect(client.closed?.code === 1008, `sustained abuse should close with 1008, got ${JSON.stringify(client.closed)}`);
      expect(hub.listConnections()[1].connections.length === 0, 'and the connection should be removed');
      state.errors = [];
    });
    pass('rate limiting');
  },

  'a channel with scope process delivers in memory and never touches Postgres': async ({ pass }) => {
    await withCleanup(async () => {
      const fast = channel('fast', { scope: 'process' });
      const clustered = channel('clustered');

      // Watches the very NOTIFY channel the hub uses, from a connection of its own
      const notifications = [];
      state.observer = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
      await state.observer.listen(BUS_CHANNEL, payload => notifications.push(payload));

      const hub = getHub();
      const client = connect(hub);
      await subscribe(hub, client, fast);

      const listenersBefore = (await db.execute(sql`select count(*)::int as n from pg_stat_activity where query ilike ${'listen %' + BUS_CHANNEL + '%'} and pid <> pg_backend_pid()`))[0].n;
      expect(listenersBefore === 1, `only the observer should be listening, found ${listenersBefore}: a process channel must not start the hub's listening connection`);

      for(let n = 0; n < 20; n++){
        const [error, result] = await publish({ channel: fast, data: { n } });
        expect(error === null && result.delivered === 1 && result.id === null, `unexpected ${JSON.stringify([error, result])}`);
      }
      await wait(250);
      expect(client.messages(fast).length === 20, `all 20 should arrive, got ${client.messages(fast).length}`);
      expect(client.messages(fast).map(m => m.data.n).join() === Array.from({ length: 20 }, (_, n) => n).join(), 'in order');
      expect(client.messages(fast).every(m => !('id' in m)), 'a process channel has no message ids');
      expect(notifications.length === 0, `not one of them may go through Postgres, but ${notifications.length} did`);

      // The observer works: a cluster channel does go through it
      await subscribe(hub, client, clustered);
      await publishOne(clustered, { n: 1 });
      await until(() => notifications.length === 1, 'the observer to see a cluster publish');
    });
    pass('process scope');
  },

  'a process channel cannot be published to from another process, which is why it is a choice': async ({ pass }) => {
    await withCleanup(async () => {
      const fast = channel('local-only', { scope: 'process' });
      const [, result] = await publish({ channel: fast, data: { n: 1 } });
      expect(result.delivered === 0, 'with no subscriber on this process, nothing is delivered and nothing is queued for another');
    });
    pass('process scope is per process');
  },

  'a channel that drops when backed up says so on each delivery, and a client that is behind is skipped': async ({ pass }) => {
    await withCleanup(async () => {
      const latest = channel('latest', { scope: 'process', dropIfBackedUp: true });
      const everything = channel('everything', { scope: 'process' });
      const hub = getHub();
      const keepingUp = connect(hub);
      const behind = connect(hub);
      for(const client of [keepingUp, behind]){
        await subscribe(hub, client, latest);
        await subscribe(hub, client, everything);
      }

      behind.behind = true;
      const [, latestResult] = await publish({ channel: latest, data: { tick: 1 } });
      expect(latestResult.delivered === 1, `only the client that is keeping up should be counted, got ${latestResult.delivered}`);
      expect(behind.messages(latest).length === 0 && keepingUp.messages(latest).length === 1, 'the client that is behind skips the stale update');
      expect(keepingUp.deliveries.find(d => d.frame.type === 'message').options?.dropIfBackedUp === true, 'a drop channel must ask for dropping on each delivery');

      const [, everythingResult] = await publish({ channel: everything, data: { chat: 'hi' } });
      expect(everythingResult.delivered === 2 && behind.messages(everything).length === 1, 'a channel that does not drop delivers to everyone, even one that is behind');
      expect(behind.deliveries.find(d => d.frame.channel === everything && d.frame.type === 'message').options === undefined, 'and does not ask for dropping');
    });
    pass('drop policy');
  },

  'a user is limited to a number of connections, and the limit is per user': async ({ pass }) => {
    await withCleanup(async () => {
      const hub = makeHub({ maxConnectionsPerUser: 2 });
      const one = connect(hub, { userId: 'capped' });
      connect(hub, { userId: 'capped' });

      const [error] = hub.addSubscriber({ token: 't', user: { id: 'capped' }, deliver: () => {}, close: () => {} });
      expect(error?.code === 429, `a third connection for the same user should be a 429, got ${JSON.stringify(error)}`);

      const [otherError] = hub.addSubscriber({ token: 't', user: { id: 'someone-else' }, deliver: () => {}, close: () => {} });
      expect(otherError === null, 'another user is unaffected');

      hub.removeSubscriber({ id: one.id });
      const [freedError] = hub.addSubscriber({ token: 't', user: { id: 'capped' }, deliver: () => {}, close: () => {} });
      expect(freedError === null, 'closing a connection frees a slot');
    });
    pass('per-user cap');
  },

  'extensions can send to, close and list connections, all scoped to this process': async ({ pass }) => {
    await withCleanup(async () => {
      const room = channel('members');
      const hub = getHub();
      const ada = connect(hub, { userId: 'ada' });
      const bob = connect(hub, { userId: 'bob' });
      await subscribe(hub, ada, room);
      await subscribe(hub, bob, room);

      expect(['publish', 'registerChannel', 'sendToConnection', 'closeConnection', 'listSubscribers', 'listConnections', 'pruneMessages'].every(name => typeof realtime[name] === 'function'), `the SDK should expose the whole surface, has ${Object.keys(realtime)}`);

      const [, listing] = realtime.listSubscribers({ channel: room });
      expect(listing.subscribers.map(s => s.userId).sort().join() === 'ada,bob', `expected ada and bob, got ${JSON.stringify(listing)}`);
      expect(listing.subscribers.every(s => s.connectionId && !('token' in s)), 'ids, never tokens');
      expect(realtime.listSubscribers({ channel: 'nobody:here' })[1].subscribers.length === 0, 'an empty channel lists nobody');

      const [directError, direct] = realtime.sendToConnection({ connectionId: ada.id, data: { hello: 'ada' } });
      expect(directError === null && direct.delivered === true, 'should deliver');
      expect(JSON.stringify(ada.frames.at(-1)) === JSON.stringify({ type: 'direct', data: { hello: 'ada' } }), `the connection should get a direct frame, got ${JSON.stringify(ada.frames.at(-1))}`);
      expect(bob.frames.every(frame => frame.type !== 'direct'), 'and nobody else');
      expect(realtime.sendToConnection({ connectionId: 'not-here', data: 1 })[0].code === 404, 'a connection that is not on this process is a 404');

      const [closeError] = realtime.closeConnection({ connectionId: bob.id, code: 4000, reason: 'bye' });
      expect(closeError === null && JSON.stringify(bob.closed) === JSON.stringify({ code: 4000, reason: 'bye' }), `the connection should be closed with what was asked, got ${JSON.stringify(bob.closed)}`);
      expect(realtime.listSubscribers({ channel: room })[1].subscribers.length === 1, 'and removed from the channel');
      expect(realtime.closeConnection({ connectionId: bob.id })[0].code === 404, 'closing it again is a 404');
    });
    pass('connection SDK');
  },

  'subscribing loads the channel\'s handler, so the first message does not pay for importing it': async ({ pass }) => {
    await withCleanup(async () => {
      const [userError, created] = await createUser({ name: 'Realtime Hub', email: USER_EMAIL, password: 'RealtimeHub123!', emailVerified: true });
      expect(!userError, `could not create a user: ${userError?.msg}`);
      await createPermission({ resource: 'warm', action: 'read', description: 'test', owner: OWNER });
      await createGroup({ name: WARM_GROUP, description: 'test', owner: OWNER });
      await addPermissionToGroup(WARM_GROUP, WARM_PERMISSION);
      await addUserToGroup(created.user.id, WARM_GROUP);

      // A declared handler whose module records that it was loaded, the moment it is
      await mkdir(path.join(PACKAGE_DIR, 'handlers'), { recursive: true });
      await writeFile(path.join(PACKAGE_DIR, 'handlers', 'warm.js'), "globalThis[Symbol.for('kempo.test.realtime.warm')] = true;\nexport default async () => 'ok';\n");
      await db.insert(extension).values({
        name: OWNER,
        version: '1.0.0',
        enabled: true,
        kempo: { realtime: { channels: [{ name: 'warm', permission: WARM_PERMISSION, onMessage: './handlers/warm.js' }] } },
        installedAt: new Date(),
        updatedAt: new Date()
      });
      invalidateScopeCache();
      clearMessageHandlerCache();
      delete globalThis[WARM_FLAG];

      const hub = makeHub();
      const client = connect(hub, { userId: created.user.id });
      expect(globalThis[WARM_FLAG] === undefined, 'the handler must not be loaded before anyone subscribes');

      await subscribe(hub, client, `${OWNER}:warm`);
      await until(() => globalThis[WARM_FLAG] === true, 'the handler to be loaded by the subscription, before any message is sent');

      const [error, result] = await hub.handleMessage({ id: client.id, channel: `${OWNER}:warm`, data: 1 });
      expect(error === null && result === 'ok', `the warmed handler should still work, got ${JSON.stringify([error, result])}`);
    });
    pass('handler warm-up');
  },

  'a handler can publish to its own channel, which is the whole extension pattern': async ({ pass }) => {
    await withCleanup(async () => {
      let chat;
      chat = channel('chat', {
        onMessage: async ({ user, data }) => {
          await publish({ channel: chat, data: { from: user.id, text: data.text } });
          return { sent: true };
        }
      });

      const hubA = makeHub();
      const hubB = makeHub();
      const ada = connect(hubA, { userId: 'ada' });
      const bob = connect(hubB, { userId: 'bob' });
      await subscribe(hubA, ada, chat);
      await subscribe(hubB, bob, chat);

      const [error, result] = await hubA.handleMessage({ id: ada.id, channel: chat, data: { text: 'hello' } });
      expect(error === null && result.sent === true, 'the handler should run and reply');

      await until(() => ada.messages(chat).length === 1 && bob.messages(chat).length === 1, 'the message to reach both processes');
      expect(bob.messages(chat)[0].data.from === 'ada' && bob.messages(chat)[0].data.text === 'hello', 'bob, on another process, should see what ada sent');
    });
    pass('chat pattern');
  }
});

export default databaseReachable
  ? tests()
  : { 'realtime hub (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
