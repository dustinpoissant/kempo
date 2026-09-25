import { sql, eq, like } from 'drizzle-orm';
import db from '../server/db/index.js';
import { realtimeMessage, realtimeChannel, session, user } from '../server/db/schema.js';
import createUser from '../server/utils/users/createUser.js';
import createSession from '../server/utils/sessions/createSession.js';
import Hub from '../server/utils/realtime/Hub.js';
import publish from '../server/utils/realtime/publish.js';
import pruneMessages from '../server/utils/realtime/pruneMessages.js';
import { registerChannel, unregisterChannel } from '../server/utils/realtime/channels.js';
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

const state = { hubs: [], errors: [], channels: [] };

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
  const client = { userId, frames: [], closed: null };
  const [error, added] = hub.addSubscriber({
    token,
    user: { id: userId, name: userId, email: `${userId}@test.local` },
    path: '/test',
    deliver: frame => client.frames.push(frame),
    close: (code, reason) => { client.closed = { code, reason }; }
  });
  expect(error === null, `could not add a subscriber: ${error?.msg}`);
  client.id = added.id;
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
  for(const name of state.channels.splice(0)) unregisterChannel(name);
  await db.delete(realtimeMessage).where(like(realtimeMessage.channel, `${OWNER}:%`)).catch(() => {});
  await db.delete(realtimeChannel).where(like(realtimeChannel.channel, `${OWNER}:%`)).catch(() => {});
  const [row] = await db.select().from(user).where(eq(user.email, USER_EMAIL));
  if(row){
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
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
  }
});

export default databaseReachable
  ? tests()
  : { 'realtime hub (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
