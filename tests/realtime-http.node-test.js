import http from 'http';
import crypto from 'crypto';
import { spawn, execFileSync } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq } from 'drizzle-orm';

/*
  The realtime socket end to end: a real kempo-server process, kempo's real middleware, the built dist
  served through the same `/kempo/**` wildcard mapping a consumer uses, a real database, and real sockets.

  The server is a separate process, so a message published from this one reaches its subscribers only by
  going through Postgres, which is what makes those assertions a check on the cross-process path and not
  just on code in one place. Channels are declared in the extension table, since that is the only way a
  channel can exist in a process this file does not control.

  Needs a reachable Postgres with kempo's schema applied and a current build (`npm run build`). Skips
  itself with a clear message when there is no database.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, userGroup, session, group, groupPermission, permission, extension, realtimeMessage } = await load('server/db/schema.js');
const createUser = (await load('server/utils/users/createUser.js')).default;
const createSession = (await load('server/utils/sessions/createSession.js')).default;
const createGroup = (await load('server/utils/groups/createGroup.js')).default;
const createPermission = (await load('server/utils/permissions/createPermission.js')).default;
const addPermissionToGroup = (await load('server/utils/permissions/addPermissionToGroup.js')).default;
const addUserToGroup = (await load('server/utils/groups/addUserToGroup.js')).default;
const publish = (await load('server/utils/realtime/publish.js')).default;
const { connect } = await load('src/kempo/realtime.js');

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const until = async (condition, description, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while(Date.now() < deadline){
    if(await condition()) return;
    await wait(20);
  }
  throw new Error(`timed out waiting for ${description}`);
};

const ADMIN = { name: 'Realtime Admin', email: 'realtime-http-admin@test.local', password: 'RealtimeAdmin123!' };
const MEMBER = { name: 'Realtime Member', email: 'realtime-http-member@test.local', password: 'RealtimeMember123!' };
const OUTSIDER = { name: 'Realtime Outsider', email: 'realtime-http-outsider@test.local', password: 'RealtimeOutsider123!' };
const EXTENSION = 'realtime-http-test-ext';
const GROUP = 'realtime-http-test:Readers';
const PERMISSION = 'realtime-http-test:feed:read';
const FEED = `${EXTENSION}:feed`;

const state = { server: null, port: null, tmp: null, cookies: {}, ids: {} };

const randomPort = () => 10000 + Math.floor(Math.random() * 20000);

const purge = async () => {
  await db.delete(extension).where(eq(extension.name, EXTENSION)).catch(() => {});
  for(const email of [ADMIN.email, MEMBER.email, OUTSIDER.email]){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
  await db.delete(groupPermission).where(eq(groupPermission.groupName, GROUP)).catch(() => {});
  await db.delete(group).where(eq(group.name, GROUP)).catch(() => {});
  await db.delete(permission).where(eq(permission.name, PERMISSION)).catch(() => {});
  await db.delete(realtimeMessage).where(eq(realtimeMessage.channel, FEED)).catch(() => {});
};

/*
  Server process
*/

const startServer = async () => {
  state.server = spawn(process.execPath, [
    path.join(root, 'node_modules', 'kempo-server', 'dist', 'index.js'),
    '--root', path.join(root, 'app-public'),
    '--config', path.join(state.tmp, 'realtime.config.json'),
    '--port', String(state.port),
    '--logging', 'silent'
  ], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, KEMPO_REALTIME_SESSION_CHECK_MS: '300' }
  });

  for(let i = 0; i < 100; i++){
    try {
      await fetch(`http://127.0.0.1:${state.port}/login`);
      return true;
    } catch {
      await wait(200);
    }
  }
  return false;
};

const stopServer = async () => {
  const server = state.server;
  state.server = null;
  if(!server) return;
  const exited = new Promise(resolve => server.once('exit', resolve));
  server.kill();
  await Promise.race([exited, wait(3000)]);
};

const login = async ({ email, password }) => {
  const response = await fetch(`http://127.0.0.1:${state.port}/kempo/api/auth/login/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual'
  });
  return (response.headers.get('set-cookie') || '').match(/session_token=([^;]+)/)?.[1] || null;
};

/*
  Sockets and requests
*/

const socketUrl = () => `ws://127.0.0.1:${state.port}/kempo/api/realtime`;

// The status of a handshake, without keeping the connection: a refusal is a plain HTTP response.
const handshakeStatus = ({ cookie, origin }) => new Promise((resolve, reject) => {
  const headers = {
    Connection: 'Upgrade',
    Upgrade: 'websocket',
    'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
    'Sec-WebSocket-Version': '13'
  };
  if(cookie) headers.Cookie = `session_token=${cookie}`;
  if(origin) headers.Origin = origin;

  const request = http.request({ host: '127.0.0.1', port: state.port, path: '/kempo/api/realtime', headers });
  request.on('upgrade', (response, socket) => { socket.destroy(); resolve(101); });
  request.on('response', response => { response.resume(); resolve(response.statusCode); });
  request.on('error', reject);
  request.setTimeout(5000, () => { request.destroy(); reject(new Error('handshake timed out')); });
  request.end();
});

const openSocket = async (cookie) => {
  const socket = new WebSocket(socketUrl(), { headers: { Cookie: `session_token=${cookie}` } });
  const client = { socket, frames: [], closed: null };
  socket.addEventListener('message', event => client.frames.push(JSON.parse(event.data)));
  socket.addEventListener('close', event => { client.closed = event.code; });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', () => reject(new Error('the socket could not be opened')));
  });

  client.of = type => client.frames.filter(frame => frame.type === type);
  client.send = frame => socket.send(JSON.stringify(frame));
  return client;
};

const get = async (urlPath, cookie) => {
  const response = await fetch(`http://127.0.0.1:${state.port}${urlPath}`, {
    headers: cookie ? { cookie: `session_token=${cookie}` } : {},
    redirect: 'manual'
  });
  return { status: response.status, text: await response.text(), headers: response.headers };
};

const buildTests = () => ({
  'a server boots with the built realtime route and the fixture users can sign in': async ({ pass }) => {
    await purge();

    try {
      execFileSync(process.execPath, [path.join(root, 'scripts', 'init-db.js')], { cwd: root, stdio: 'ignore' });
    } catch(e) {
      throw new Error(`could not seed system groups and permissions: ${e.message}`);
    }

    const [adminError, admin] = await createUser({ ...ADMIN, emailVerified: true });
    expect(!adminError, `could not create the admin: ${adminError?.msg}`);
    expect(!(await addUserToGroup(admin.user.id, 'system:Administrators'))[0], 'could not make the admin an administrator');

    const [memberError, member] = await createUser({ ...MEMBER, emailVerified: true });
    expect(!memberError, `could not create the member: ${memberError?.msg}`);
    const [outsiderError, outsider] = await createUser({ ...OUTSIDER, emailVerified: true });
    expect(!outsiderError, `could not create the outsider: ${outsiderError?.msg}`);
    state.ids = { admin: admin.user.id, member: member.user.id, outsider: outsider.user.id };

    await createPermission({ resource: 'feed', action: 'read', description: 'test', owner: 'realtime-http-test' });
    await createGroup({ name: GROUP, description: 'test', owner: 'realtime-http-test' });
    await addPermissionToGroup(GROUP, PERMISSION);
    await addUserToGroup(member.user.id, GROUP);

    // The only way to declare a channel in a process this test does not control
    await db.insert(extension).values({
      name: EXTENSION,
      version: '1.0.0',
      enabled: true,
      kempo: { realtime: { channels: [{ name: 'feed', permission: PERMISSION, persist: true, retention: '1h' }] } },
      installedAt: new Date(),
      updatedAt: new Date()
    });

    state.tmp = path.join(root, 'tests', '.tmp-realtime');
    await mkdir(state.tmp, { recursive: true });
    await writeFile(path.join(state.tmp, 'realtime.config.json'), JSON.stringify({
      customRoutes: { '/kempo/**': '../dist/kempo/**' },
      middleware: { custom: ['../middleware/kempo.js'] },
      templating: { ssr: true, ssrPriority: true, preRender: false }
    }, null, 2));

    state.port = randomPort();
    expect(await startServer(), `the server did not start on port ${state.port}`);

    state.cookies.admin = await login(ADMIN);
    state.cookies.member = await login(MEMBER);
    state.cookies.outsider = await login(OUTSIDER);
    expect(state.cookies.admin && state.cookies.member && state.cookies.outsider, 'the fixture users could not sign in');
    pass();
  },

  'the handshake goes through the real middleware and is refused, or allowed, for the right reasons': async ({ pass }) => {
    expect(await handshakeStatus({}) === 401, 'no cookie should be a 401');
    expect(await handshakeStatus({ cookie: 'a'.repeat(64) }) === 401, 'a cookie matching no session should be a 401');
    expect(await handshakeStatus({ cookie: state.cookies.member, origin: 'http://evil.test' }) === 403, 'a valid session sent from a foreign origin must be refused, or any site could open a socket as the signed-in user');
    expect(await handshakeStatus({ cookie: state.cookies.member, origin: `http://127.0.0.1:${state.port}` }) === 101, 'a valid session from the same origin should be accepted');
    expect(await handshakeStatus({ cookie: state.cookies.member }) === 101, 'a valid session with no Origin (a non-browser client) should be accepted');
    pass();
  },

  'a signed-in socket is told who it is, and a message published from another process reaches it': async ({ pass }) => {
    const client = await openSocket(state.cookies.member);
    try {
      await until(() => client.of('ready').length === 1, 'the ready frame');
      expect(client.of('ready')[0].userId === state.ids.member, 'ready should carry the signed-in user\'s id');

      client.send({ type: 'subscribe', channel: `user:${state.ids.member}` });
      await until(() => client.of('subscribed').length === 1, 'the subscription to the user\'s own channel');

      // Published here, delivered by a different process: the only path between them is Postgres
      const [error] = await publish({ channel: `user:${state.ids.member}`, data: { hello: 'from another process' } });
      expect(error === null, `publish failed: ${error?.msg}`);

      await until(() => client.of('message').length === 1, 'the message');
      expect(client.of('message')[0].data.hello === 'from another process', 'the payload should arrive intact');
    } finally {
      client.socket.close();
    }
    pass();
  },

  'a channel an extension declared is gated by its permission': async ({ pass }) => {
    const member = await openSocket(state.cookies.member);
    const outsider = await openSocket(state.cookies.outsider);
    try {
      member.send({ type: 'subscribe', channel: FEED });
      outsider.send({ type: 'subscribe', channel: FEED });
      member.send({ type: 'subscribe', channel: 'no-such-extension:feed' });
      member.send({ type: 'subscribe', channel: `user:${state.ids.outsider}` });

      await until(() => outsider.of('error').length === 1 && member.of('error').length === 2 && member.of('subscribed').length === 1, 'every reply');
      expect(member.of('subscribed')[0].channel === FEED, 'a user with the permission should be subscribed');
      expect(outsider.of('error')[0].code === 403 && outsider.of('subscribed').length === 0, 'a user without the permission must be refused');
      expect(member.of('error').map(e => e.code).sort().join() === '403,404', `expected a 404 for the unknown channel and a 403 for someone else's, got ${member.of('error').map(e => e.code)}`);
    } finally {
      member.socket.close();
      outsider.socket.close();
    }
    pass();
  },

  'a socket that sends nonsense gets an error frame and stays connected': async ({ pass }) => {
    const client = await openSocket(state.cookies.member);
    try {
      client.socket.send('this is not json');
      client.send({ type: 'no-such-type' });
      client.send({ type: 'subscribe' });
      await until(() => client.of('error').length === 3, 'three error frames');
      expect(client.of('error').every(e => e.code === 400 || e.code === 400), 'each should be a 400');
      expect(client.closed === null, 'the connection must survive bad frames');
    } finally {
      client.socket.close();
    }
    pass();
  },

  'a persisted channel replays what a new socket missed': async ({ pass }) => {
    const ids = [];
    for(const n of [1, 2, 3]){
      const [error, result] = await publish({ channel: FEED, data: { n } });
      expect(error === null, `publish failed: ${error?.msg}`);
      ids.push(result.id);
    }

    const client = await openSocket(state.cookies.member);
    try {
      client.send({ type: 'subscribe', channel: FEED, since: ids[0] });
      await until(() => client.of('message').length === 2, 'the two missed messages');
      expect(client.of('message').map(m => m.data.n).join() === '2,3', 'should replay everything after since, in order');
      expect(client.of('message').map(m => m.id).join() === ids.slice(1).join(), 'replayed ids should match');
    } finally {
      client.socket.close();
    }
    pass();
  },

  'a socket is closed when its session is revoked, and the others are left alone': async ({ pass }) => {
    const [, extra] = await createSession(state.ids.member);
    const revoked = await openSocket(extra.sessionToken);
    const staying = await openSocket(state.cookies.member);
    try {
      await until(() => revoked.of('ready').length === 1 && staying.of('ready').length === 1, 'both sockets to be ready');

      await db.delete(session).where(eq(session.token, extra.sessionToken));
      await until(() => revoked.closed !== null, 'the revoked socket to be closed', 4000);
      expect(revoked.closed === 4401, `expected close code 4401, got ${revoked.closed}`);

      await wait(700);
      expect(staying.closed === null, 'a socket on a different, valid session must stay open');
    } finally {
      staying.socket.close();
    }
    pass();
  },

  'the admin connections endpoint and page are permission-gated': async ({ pass }) => {
    const client = await openSocket(state.cookies.member);
    try {
      client.send({ type: 'subscribe', channel: FEED });
      await until(() => client.of('subscribed').length === 1, 'the subscription');

      expect((await get('/kempo/api/realtime/connections')).status === 401, 'anonymous should be a 401');
      expect((await get('/kempo/api/realtime/connections', state.cookies.member)).status === 403, 'a member without system:realtime:read should be a 403');

      const admin = await get('/kempo/api/realtime/connections', state.cookies.admin);
      expect(admin.status === 200, `an administrator should be allowed, got ${admin.status}`);

      const summary = JSON.parse(admin.text);
      const mine = summary.connections.find(connection => connection.userId === state.ids.member);
      expect(mine && mine.path === '/kempo/api/realtime' && mine.channels.includes(FEED), `the member's connection should be listed with its channel, got ${admin.text}`);
      expect(summary.channels.some(channel => channel.channel === FEED && channel.subscribers >= 1), 'the channel should be counted');
      expect(!admin.text.includes(state.cookies.member), 'a session token must never appear in the listing');

      expect((await get('/admin/realtime', state.cookies.member)).status === 302, 'the admin page should redirect a non-admin');
      expect((await get('/admin/realtime', state.cookies.admin)).status === 200, 'the admin page should render for an administrator');
    } finally {
      client.socket.close();
    }
    pass();
  },

  'the browser client is served, and it reconnects and replays what it missed across a server restart': async ({ pass }) => {
    const served = await get('/kempo/realtime.js');
    expect(served.status === 200 && (served.headers.get('content-type') || '').includes('javascript'), `the client should be served as JavaScript, got ${served.status} ${served.headers.get('content-type')}`);
    expect(served.text.includes('RealtimeClient') || served.text.includes('subscribe'), 'the served file should be the client');

    // The client under test is the source module; Node's WebSocket needs the cookie added the browser would send
    const CookieWebSocket = class extends WebSocket {
      constructor(url){
        super(url, { headers: { Cookie: `session_token=${state.cookies.member}` } });
      }
    };

    const received = [];
    const statuses = [];
    const client = connect({ url: socketUrl(), WebSocket: CookieWebSocket, backoff: { base: 50, max: 250 } });
    client.onStatus(status => statuses.push(status));

    try {
      client.subscribe(FEED, (data, meta) => received.push({ n: data.n, id: meta.id }));
      await until(() => client.status === 'open', 'the client to connect');

      const [, first] = await publish({ channel: FEED, data: { n: 100 } });
      await until(() => received.length === 1, 'the first live message');

      // Server goes away; a message is published while nothing is listening
      await stopServer();
      await until(() => client.status === 'reconnecting', 'the client to notice');
      const [, missed] = await publish({ channel: FEED, data: { n: 101 } });
      const [, alsoMissed] = await publish({ channel: FEED, data: { n: 102 } });

      expect(await startServer(), 'the server did not restart');
      await until(() => client.status === 'open', 'the client to reconnect', 10000).catch(error => { throw new Error(`${error.message} (statuses: ${statuses.join(' > ')}, now ${client.status})`); });
      await until(() => received.length === 3, 'the messages published during the outage', 8000);

      expect(JSON.stringify(received.map(r => r.n)) === JSON.stringify([100, 101, 102]), `expected 100,101,102, got ${received.map(r => r.n)}`);
      expect(JSON.stringify(received.map(r => r.id)) === JSON.stringify([first.id, missed.id, alsoMissed.id]), 'ids should match what was published');

      const [, live] = await publish({ channel: FEED, data: { n: 103 } });
      await until(() => received.length === 4 && received[3].id === live.id, 'live delivery to resume after replay');
      expect(received.map(r => r.id).every((id, index, all) => index === 0 || id > all[index - 1]), 'nothing repeated or reordered');
    } finally {
      client.close();
    }
    pass();
  }
});

export const afterAll = async () => {
  await stopServer();
  if(state.tmp) await rm(state.tmp, { recursive: true, force: true }).catch(() => {});
  if(databaseReachable) await purge();
};

export default databaseReachable
  ? buildTests()
  : { 'realtime http (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
