import net from 'net';
import crypto from 'crypto';
import { spawn, execFileSync } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq } from 'drizzle-orm';

/*
  How much a single kempo process can carry, measured rather than assumed.

  Twenty clients share one channel with scope "process". Each sends 20 messages a second, and a handler
  in the server publishes every one to all twenty, so the server is doing 400 messages a second in and
  8,000 deliveries a second out, the load of a busy shared world at its largest expected size.

  Latency is measured from just before a client sends to the moment any client receives that message, so
  it includes the socket, the handler, the fan-out and JSON on both sides, over loopback. The clients run
  in this test process, sharing a machine and an event loop with the measurement itself, so what it reports
  is pessimistic: a real client on its own machine is not also competing with nineteen others for a CPU.

  Loopback has no network latency. A real player adds their round-trip time to every figure here.

  Needs a reachable Postgres and a current build. Skips itself with a message when there is no database.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, userGroup, session, group, groupPermission, permission, extension } = await load('server/db/schema.js');
const createUser = (await load('server/utils/users/createUser.js')).default;
const createGroup = (await load('server/utils/groups/createGroup.js')).default;
const createPermission = (await load('server/utils/permissions/createPermission.js')).default;
const addPermissionToGroup = (await load('server/utils/permissions/addPermissionToGroup.js')).default;
const addUserToGroup = (await load('server/utils/groups/addUserToGroup.js')).default;

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const CLIENTS = 20;
const SENDS_PER_SECOND = 20;
const SECONDS = 5;

const PLAYER = { name: 'Capacity Player', email: 'realtime-capacity@test.local', password: 'RealtimeCapacity123!' };
const EXTENSION = 'realtime-capacity-test-ext';
const ARENA = `${EXTENSION}:arena`;
const GROUP = 'realtime-capacity-test:Players';
const PERMISSION = 'realtime-capacity-test:arena:read';
const PACKAGE_DIR = path.join(root, 'node_modules', EXTENSION);

const state = { server: null, tmp: null, port: null, cookie: null };

const purge = async () => {
  await rm(PACKAGE_DIR, { recursive: true, force: true }).catch(() => {});
  await db.delete(extension).where(eq(extension.name, EXTENSION)).catch(() => {});
  const [row] = await db.select().from(user).where(eq(user.email, PLAYER.email));
  if(row){
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
  await db.delete(groupPermission).where(eq(groupPermission.groupName, GROUP)).catch(() => {});
  await db.delete(group).where(eq(group.name, GROUP)).catch(() => {});
  await db.delete(permission).where(eq(permission.name, PERMISSION)).catch(() => {});
};

const percentile = (sorted, fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];

/*
  The same client written on a raw TCP socket, so TCP_NODELAY can be set. Node's built-in WebSocket does not
  expose it, and without it a small write can be held back by Nagle's algorithm until the peer's delayed
  ACK arrives, which on Windows is a fixed 200ms. Browsers set TCP_NODELAY on their WebSocket connections,
  so this is the closer stand-in for a real player.
*/
const rawClient = ({ port, cookie, onText }) => new Promise((resolve, reject) => {
  const key = crypto.randomBytes(16).toString('base64');
  let buffer = Buffer.alloc(0);
  let upgraded = false;
  const client = { closed: null };

  const socket = net.connect(port, '127.0.0.1', () => {
    socket.setNoDelay(true);
    socket.write(`GET /kempo/api/realtime HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\nCookie: session_token=${cookie}\r\n\r\n`);
  });

  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);

    if(!upgraded){
      const end = buffer.indexOf('\r\n\r\n');
      if(end === -1) return;
      if(!buffer.subarray(0, end).toString().startsWith('HTTP/1.1 101')){
        reject(new Error(`handshake failed: ${buffer.subarray(0, end).toString().split('\r\n')[0]}`));
        return;
      }
      upgraded = true;
      buffer = buffer.subarray(end + 4);
      resolve(client);
    }

    for(;;){
      if(buffer.length < 2) return;
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if(length === 126){
        if(buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if(length === 127){
        if(buffer.length < 10) return;
        length = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if(buffer.length < offset + length) return;
      const opcode = buffer[0] & 0x0f;
      const payload = buffer.subarray(offset, offset + length);
      buffer = buffer.subarray(offset + length);
      if(opcode === 1) onText(payload.toString('utf8'));
      if(opcode === 8) client.closed = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
    }
  });
  socket.on('error', reject);
  socket.on('close', () => { if(client.closed === null) client.closed = 1006; });

  // Client frames must be masked
  client.send = (object) => {
    const payload = Buffer.from(JSON.stringify(object));
    const header = payload.length < 126
      ? Buffer.from([0x81, 0x80 | payload.length])
      : Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 0xff]);
    const mask = crypto.randomBytes(4);
    const masked = Buffer.allocUnsafe(payload.length);
    for(let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i & 3];
    socket.write(Buffer.concat([header, mask, masked]));
  };
  client.close = () => socket.destroy();
});

const buildTests = () => ({
  'twenty clients at twenty messages a second: nothing is lost and latency stays low': async ({ pass, log }) => {
    await purge();

    try {
      execFileSync(process.execPath, [path.join(root, 'scripts', 'init-db.js')], { cwd: root, stdio: 'ignore' });
    } catch(e) {
      throw new Error(`could not seed system groups and permissions: ${e.message}`);
    }

    const [playerError, player] = await createUser({ ...PLAYER, emailVerified: true });
    expect(!playerError, `could not create the player: ${playerError?.msg}`);
    await createPermission({ resource: 'arena', action: 'read', description: 'test', owner: 'realtime-capacity-test' });
    await createGroup({ name: GROUP, description: 'test', owner: 'realtime-capacity-test' });
    await addPermissionToGroup(GROUP, PERMISSION);
    await addUserToGroup(player.user.id, GROUP);

    await db.insert(extension).values({
      name: EXTENSION,
      version: '1.0.0',
      enabled: true,
      kempo: { realtime: { channels: [{ name: 'arena', permission: PERMISSION, scope: 'process', onMessage: './handlers/arena.js' }] } },
      installedAt: new Date(),
      updatedAt: new Date()
    });

    await mkdir(path.join(PACKAGE_DIR, 'handlers'), { recursive: true });
    await writeFile(path.join(PACKAGE_DIR, 'handlers', 'arena.js'), [
      `import { realtime } from ${JSON.stringify(pathToFileURL(path.join(root, 'server', 'sdk.js')).href)};`,
      "export default async ({ user, data }) => {",
      `  await realtime.publish({ channel: '${ARENA}', data: { from: user.id, who: data.who, seq: data.seq, t: data.t } });`,
      "};",
      ""
    ].join('\n'));

    state.tmp = path.join(root, 'tests', '.tmp-capacity');
    await mkdir(state.tmp, { recursive: true });
    await writeFile(path.join(state.tmp, 'capacity.config.json'), JSON.stringify({
      customRoutes: { '/kempo/**': '../dist/kempo/**' },
      middleware: { custom: ['../middleware/kempo.js'] },
      templating: { ssr: true, ssrPriority: true, preRender: false }
    }, null, 2));

    state.port = 10000 + Math.floor(Math.random() * 20000);
    state.server = spawn(process.execPath, [
      path.join(root, 'node_modules', 'kempo-server', 'dist', 'index.js'),
      '--root', path.join(root, 'app-public'),
      '--config', path.join(state.tmp, 'capacity.config.json'),
      '--port', String(state.port),
      '--logging', 'silent'
    ], {
      cwd: root,
      stdio: 'ignore',
      // Twenty connections from one user, sending at the rate a game would
      env: { ...process.env, KEMPO_REALTIME_MAX_CONNECTIONS_PER_USER: '100', KEMPO_REALTIME_MAX_MESSAGES_PER_SECOND: '1000' }
    });

    let up = false;
    for(let i = 0; i < 100 && !up; i++){
      up = await fetch(`http://127.0.0.1:${state.port}/login`).then(() => true).catch(() => wait(200).then(() => false));
    }
    expect(up, 'the server did not start');

    const login = await fetch(`http://127.0.0.1:${state.port}/kempo/api/auth/login/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: PLAYER.email, password: PLAYER.password }),
      redirect: 'manual'
    });
    state.cookie = (login.headers.get('set-cookie') || '').match(/session_token=([^;]+)/)?.[1];
    expect(state.cookie, 'the player could not sign in');

    /*
      One run: connect and subscribe every client before measuring anything, then have each send on its own
      timer as independent players would, and time every delivery of every message.
    */
    const measure = async (kind) => {
      const clients = [];
      const latencies = [];
      let received = 0;
      let malformed = 0;

      for(let who = 0; who < CLIENTS; who++){
        const client = { who, subscribed: false };
        const handle = (text) => {
          const frame = JSON.parse(text);
          if(frame.type === 'subscribed') client.subscribed = true;
          if(frame.type !== 'message') return;
          if(typeof frame.data.t !== 'number'){
            malformed++;
            return;
          }
          received++;
          latencies.push(performance.now() - frame.data.t);
        };

        if(kind === 'raw'){
          const raw = await rawClient({ port: state.port, cookie: state.cookie, onText: handle });
          client.send = raw.send;
          client.close = raw.close;
          client.closedCode = () => raw.closed;
        } else {
          const socket = new WebSocket(`ws://127.0.0.1:${state.port}/kempo/api/realtime`, { headers: { Cookie: `session_token=${state.cookie}` } });
          let closed = null;
          socket.addEventListener('message', event => handle(event.data));
          socket.addEventListener('close', event => { closed = event.code; });
          await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve);
            socket.addEventListener('error', () => reject(new Error(`client ${who} could not connect`)));
          });
          client.send = object => socket.send(JSON.stringify(object));
          client.close = () => socket.close();
          client.closedCode = () => closed;
        }

        client.send({ type: 'subscribe', channel: ARENA });
        clients.push(client);
      }

      for(let i = 0; i < 100 && !clients.every(client => client.subscribed); i++) await wait(50);
      expect(clients.every(client => client.subscribed), `every ${kind} client should be subscribed before measuring`);

      /*
        Timers cannot tick every 50ms on every platform (Windows rounds to about 15ms), so a plain interval
        under-delivers. Each client instead wakes often and sends however many messages are due by now, which
        holds the real rate at SENDS_PER_SECOND without changing when they are sent.
      */
      let sent = 0;
      const startedAt = performance.now();
      const timers = clients.map(client => {
        let seq = 0;
        return setInterval(() => {
          const due = Math.floor((performance.now() - startedAt) / (1000 / SENDS_PER_SECOND)) - seq;
          for(let i = 0; i < due; i++){
            client.send({ type: 'send', channel: ARENA, data: { who: client.who, seq: seq++, t: performance.now() } });
            sent++;
          }
        }, 5);
      });

      await wait(SECONDS * 1000);
      timers.forEach(clearInterval);
      // Let what is still in flight land before counting
      await wait(1500);

      const expected = sent * CLIENTS;
      latencies.sort((a, b) => a - b);
      const round = value => Math.round(value * 10) / 10;
      const report = {
        client: kind === 'raw' ? 'raw TCP, no-delay (like a browser)' : "Node's built-in WebSocket",
        clients: CLIENTS,
        seconds: SECONDS,
        achievedSendsPerSecond: Math.round(sent / SECONDS),
        deliveriesExpected: expected,
        deliveriesReceived: received,
        p50: round(percentile(latencies, 0.5)),
        p95: round(percentile(latencies, 0.95)),
        p99: round(percentile(latencies, 0.99)),
        max: round(latencies.at(-1))
      };
      console.log(`\n  capacity: ${JSON.stringify(report)}`);
      log(JSON.stringify(report));

      const closes = clients.map(client => client.closedCode());
      clients.forEach(client => client.close());

      expect(closes.every(code => code === null || code === 1000 || code === 1005), `no ${kind} client should have been cut off, closes: ${closes}`);
      expect(malformed === 0, `${malformed} frames were not what the handler published`);
      expect(received === expected, `every message should reach every ${kind} client, but ${expected - received} of ${expected} deliveries were lost`);
      // The bounds are deliberately generous so a slow or busy machine does not fail the run; the printed figures are the result
      expect(report.p95 < 500, `95% of deliveries should arrive within 500ms, p95 was ${report.p95}ms (${kind})`);
      expect(report.p50 < 250, `the median delivery should arrive within 250ms, p50 was ${report.p50}ms (${kind})`);
      // A handler that is only loaded on the first message stalls every connection's first sends for ~200ms; this catches that coming back
      expect(report.p99 < 150, `99% of deliveries should arrive within 150ms, p99 was ${report.p99}ms (${kind}); a p99 near 200ms means something is loaded lazily on the first message`);
      return report;
    };

    const raw = await measure('raw');
    await wait(500);
    const builtin = await measure('websocket');
    pass(`raw no-delay client: p50 ${raw.p50}ms, p95 ${raw.p95}ms, p99 ${raw.p99}ms, max ${raw.max}ms; built-in client: p50 ${builtin.p50}ms, p95 ${builtin.p95}ms, p99 ${builtin.p99}ms, max ${builtin.max}ms`);
  }
});

export const afterAll = async () => {
  const server = state.server;
  state.server = null;
  if(server){
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await Promise.race([exited, wait(3000)]);
  }
  if(state.tmp) await rm(state.tmp, { recursive: true, force: true }).catch(() => {});
  if(databaseReachable) await purge();
};

export default databaseReachable
  ? buildTests()
  : { 'realtime capacity (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
