import { spawn, execFileSync } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq } from 'drizzle-orm';

/*
  The notification routes over real HTTP: a real kempo-server process, kempo's real middleware, the built
  dist served through the same `/kempo/**` mapping a consumer uses, and a real database.

  What matters here is who is allowed to see and change what. Every route acts on the signed-in user's own
  notification state and on nobody else's, so each one is attacked with another user's notification id and
  with no session at all.

  Needs a reachable Postgres with kempo's schema applied and a current build (`npm run build`). Skips itself
  with a clear message when there is no database.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, userGroup, session, notification } = await load('server/db/schema.js');
const createUser = (await load('server/utils/users/createUser.js')).default;
const addUserToGroup = (await load('server/utils/groups/addUserToGroup.js')).default;
const createNotification = (await load('server/utils/notifications/createNotification.js')).default;

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const OWNER = 'notif-http-test';
const ADMIN = { name: 'Notif Admin', email: 'notif-http-admin@test.local', password: 'NotifAdmin123!' };
const MEMBER = { name: 'Notif Member', email: 'notif-http-member@test.local', password: 'NotifMember123!' };
const OTHER = { name: 'Notif Other', email: 'notif-http-other@test.local', password: 'NotifOther123!' };

const state = { server: null, port: null, tmp: null, cookies: {}, ids: {}, notifications: {} };

const purge = async () => {
  await db.delete(notification).where(eq(notification.owner, OWNER)).catch(() => {});
  for(const email of [ADMIN.email, MEMBER.email, OTHER.email]){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
};

const randomPort = () => 10000 + Math.floor(Math.random() * 20000);

const waitForServer = async port => {
  for(let i = 0; i < 100; i++){
    try {
      await fetch(`http://127.0.0.1:${port}/login`);
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return false;
};

const login = async ({ email, password }) => {
  const res = await fetch(`http://127.0.0.1:${state.port}/kempo/api/auth/login/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual'
  });
  return (res.headers.get('set-cookie') || '').match(/session_token=([^;]+)/)?.[1] || null;
};

const call = async (method, urlPath, as, body) => {
  const headers = {};
  if(as && state.cookies[as]) headers.cookie = `session_token=${state.cookies[as]}`;
  if(body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`http://127.0.0.1:${state.port}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(5000)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
};

const send = async input => {
  const [error, result] = await createNotification({ owner: OWNER, ...input });
  expect(error === null, `could not create a notification: ${JSON.stringify(error)}`);
  return result.notification;
};

const buildTests = () => ({
  'a server boots and the fixture users can sign in': async ({ pass }) => {
    await purge();

    try {
      execFileSync(process.execPath, [path.join(root, 'scripts', 'init-db.js')], { cwd: root, stdio: 'ignore' });
    } catch(e) {
      throw new Error(`could not seed system groups and permissions: ${e.message}`);
    }

    for(const [key, account] of [['admin', ADMIN], ['member', MEMBER], ['other', OTHER]]){
      const [error, created] = await createUser({ ...account, emailVerified: true });
      expect(!error, `could not create ${key}: ${error?.msg}`);
      state.ids[key] = created.user.id;
    }
    expect(!(await addUserToGroup(state.ids.admin, 'system:Administrators'))[0], 'could not make the admin an administrator');

    state.tmp = path.join(root, 'tests', '.tmp-notifications-http');
    await mkdir(state.tmp, { recursive: true });
    await writeFile(path.join(state.tmp, 'notifications.config.json'), JSON.stringify({
      customRoutes: { '/kempo/**': '../dist/kempo/**' },
      middleware: { custom: ['../middleware/kempo.js'] },
      templating: { ssr: true, ssrPriority: true, preRender: false }
    }, null, 2));

    state.port = randomPort();
    state.server = spawn(process.execPath, [
      path.join(root, 'node_modules', 'kempo-server', 'dist', 'index.js'),
      '--root', path.join(root, 'app-public'),
      '--config', path.join(state.tmp, 'notifications.config.json'),
      '--port', String(state.port),
      '--logging', 'silent'
    ], { cwd: root, stdio: 'ignore' });
    expect(await waitForServer(state.port), `the server did not start on port ${state.port}`);

    state.cookies.admin = await login(ADMIN);
    state.cookies.member = await login(MEMBER);
    state.cookies.other = await login(OTHER);
    expect(state.cookies.admin && state.cookies.member && state.cookies.other, 'the fixture users could not sign in');

    state.notifications.member = await send({ title: 'For the member', message: 'm', userIds: [state.ids.member] });
    state.notifications.other = await send({ title: 'For the other', message: 'o', userIds: [state.ids.other] });
    state.notifications.both = await send({ title: 'For both', userIds: [state.ids.member, state.ids.other] });
    pass();
  },

  'every route refuses a request with no session or an unknown one': async ({ pass }) => {
    const id = state.notifications.member.id;
    const routes = [
      ['GET', '/kempo/api/notifications'],
      ['GET', '/kempo/api/notifications/count'],
      ['POST', '/kempo/api/notifications/read-all'],
      ['POST', `/kempo/api/notifications/${id}/read`],
      ['POST', `/kempo/api/notifications/${id}/handled`],
      ['DELETE', `/kempo/api/notifications/${id}`]
    ];
    state.cookies.invalid = 'a'.repeat(64);

    for(const as of [null, 'invalid']){
      for(const [method, urlPath] of routes){
        const { status, text } = await call(method, urlPath, as, method === 'GET' ? undefined : {});
        expect(status === 401, `${method} ${urlPath} as ${as ?? 'anonymous'} should be a 401, got ${status}`);
        expect(!text.includes('For the member'), 'a refusal must not leak any notification');
      }
    }

    const untouched = await call('GET', '/kempo/api/notifications', 'member');
    expect(untouched.json.unread === 2 && untouched.json.notifications.every(n => n.readAt === null), 'nothing was changed by the refused requests');
    pass();
  },

  'a user lists only their own notifications, and an administrator is not special': async ({ pass }) => {
    const member = await call('GET', '/kempo/api/notifications', 'member');
    expect(member.status === 200, `got ${member.status}`);
    expect(JSON.stringify(member.json.notifications.map(n => n.title).sort()) === JSON.stringify(['For both', 'For the member']), `the member should see exactly theirs, got ${member.json.notifications.map(n => n.title)}`);
    expect(member.json.total === 2 && member.json.unread === 2, 'with totals');

    const admin = await call('GET', '/kempo/api/notifications', 'admin');
    expect(admin.status === 200 && admin.json.notifications.length === 0, 'an administrator has no access to other people\'s notifications');

    const shape = member.json.notifications[0];
    expect(!('userId' in shape) && !('dedupeKey' in shape) && 'actions' in shape && 'readAt' in shape && 'handledAt' in shape, `unexpected fields ${Object.keys(shape)}`);
    pass();
  },

  'the unread count matches and the list can be paged and filtered': async ({ pass }) => {
    expect((await call('GET', '/kempo/api/notifications/count', 'member')).json.count === 2, 'two unread');

    const page = await call('GET', '/kempo/api/notifications?limit=1&offset=1', 'member');
    expect(page.json.notifications.length === 1 && page.json.total === 2 && page.json.limit === 1 && page.json.offset === 1, 'paging');
    expect((await call('GET', '/kempo/api/notifications?limit=100000', 'member')).json.limit === 100, 'the page size is capped');
    expect((await call('GET', '/kempo/api/notifications?limit=abc&offset=-5', 'member')).status === 200, 'junk paging values are tolerated');
    expect((await call('GET', '/kempo/api/notifications?unreadOnly=true', 'member')).json.total === 2, 'the unread filter');
    pass();
  },

  'read, handled and dismiss act on the caller\'s own state and cannot reach anyone else\'s': async ({ pass }) => {
    const theirs = state.notifications.other.id;
    const shared = state.notifications.both.id;

    for(const [method, suffix] of [['POST', '/read'], ['POST', '/handled'], ['DELETE', '']]){
      const attempt = await call(method, `/kempo/api/notifications/${theirs}${suffix}`, 'member', method === 'POST' ? {} : undefined);
      expect(attempt.status === 404, `${method} on someone else's notification should be a 404, got ${attempt.status}`);
    }
    const stillTheirs = await call('GET', '/kempo/api/notifications', 'other');
    const theirCopy = stillTheirs.json.notifications.find(n => n.id === theirs);
    expect(theirCopy && theirCopy.readAt === null && theirCopy.handledAt === null, 'and their copy is untouched');

    expect((await call('POST', `/kempo/api/notifications/${shared}/read`, 'member', {})).status === 200, 'the member reads the shared one');
    const other = (await call('GET', '/kempo/api/notifications', 'other')).json.notifications.find(n => n.id === shared);
    expect(other.readAt === null, 'which does not read it for the other recipient');
    expect((await call('GET', '/kempo/api/notifications/count', 'member')).json.count === 1, 'the member\'s count dropped');
    expect((await call('GET', '/kempo/api/notifications/count', 'other')).json.count === 2, 'the other\'s did not');

    expect((await call('POST', `/kempo/api/notifications/${shared}/handled`, 'other', {})).status === 200, 'handled works for a recipient');
    const handled = (await call('GET', '/kempo/api/notifications', 'other')).json.notifications.find(n => n.id === shared);
    expect(handled.handledAt && handled.readAt, 'handled also reads');
    expect((await call('POST', '/kempo/api/notifications/no-such-id/read', 'member', {})).status === 404, 'an unknown id is a 404');

    expect((await call('DELETE', `/kempo/api/notifications/${shared}`, 'member')).status === 200, 'the member dismisses theirs');
    expect(!(await call('GET', '/kempo/api/notifications', 'member')).json.notifications.some(n => n.id === shared), 'it is gone from the member\'s list');
    expect((await call('GET', '/kempo/api/notifications', 'other')).json.notifications.some(n => n.id === shared), 'but not from the other\'s');
    pass();
  },

  'read-all reads only the caller\'s notifications': async ({ pass }) => {
    const before = (await call('GET', '/kempo/api/notifications/count', 'other')).json.count;
    expect(before >= 1, 'the other user has something unread');
    const result = await call('POST', '/kempo/api/notifications/read-all', 'member', {});
    expect(result.status === 200 && result.json.updated >= 1, `got ${result.status} ${result.text}`);
    expect((await call('GET', '/kempo/api/notifications/count', 'member')).json.count === 0, 'the member has none left');
    expect((await call('GET', '/kempo/api/notifications/count', 'other')).json.count === before, 'the other user\'s count is unchanged');
    pass();
  },

  'a request cannot name another user or smuggle one in': async ({ pass }) => {
    const sneaky = await call('GET', `/kempo/api/notifications?userId=${state.ids.other}`, 'member');
    expect(!sneaky.json.notifications.some(n => n.title === 'For the other'), 'a userId query parameter must be ignored');
    const body = await call('POST', `/kempo/api/notifications/${state.notifications.other.id}/read`, 'member', { userId: state.ids.other });
    expect(body.status === 404, 'a userId in the body must be ignored too');
    pass();
  },

  'actions come back as stored and a title or message is returned as plain data': async ({ pass }) => {
    const payload = '<img src=x onerror=alert(1)>';
    await send({
      title: payload,
      message: payload,
      userIds: [state.ids.member],
      actions: [{ label: 'Try again', api: { method: 'POST', url: '/kempo/api/thumbs/retry', body: { id: 3 } } }, { label: 'Open', href: '/admin/notifications' }]
    });
    const list = await call('GET', '/kempo/api/notifications', 'member');
    expect(list.status === 200 && /application\/json/.test('application/json'), 'listed');
    const item = list.json.notifications.find(n => n.title === payload);
    expect(item && item.message === payload, 'returned verbatim, as JSON data, never markup');
    expect(item.actions[0].api.method === 'POST' && item.actions[0].api.url === '/kempo/api/thumbs/retry' && item.actions[1].href === '/admin/notifications', 'actions are returned');
    pass();
  },

  'the admin page is for administrators and the bell component is served': async ({ pass }) => {
    const get = async (urlPath, as) => {
      const headers = as ? { cookie: `session_token=${state.cookies[as]}` } : {};
      return (await fetch(`http://127.0.0.1:${state.port}${urlPath}`, { headers, redirect: 'manual' })).status;
    };
    expect(await get('/admin/notifications') === 302, 'anonymous is redirected');
    expect(await get('/admin/notifications', 'member') === 302, 'a member without admin access is redirected');
    expect(await get('/admin/notifications', 'admin') === 200, 'an administrator sees it');
    expect(await get('/kempo/components/NotificationBell.js') === 200 && await get('/kempo/components/NotificationList.js') === 200, 'the components are served for any site to use');
    expect(await get('/kempo/icons/notifications.svg') === 200 && await get('/kempo/icons/info.svg') === 200, 'and so are their icons');
    pass();
  },
});

export const afterAll = async () => {
  const server = state.server;
  state.server = null;
  if(server){
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
  }
  if(state.tmp) await rm(state.tmp, { recursive: true, force: true }).catch(() => {});
  if(databaseReachable) await purge();
};

export default databaseReachable
  ? buildTests()
  : { 'notifications http (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
