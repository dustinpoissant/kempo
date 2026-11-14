import path from 'path';
import crypto from 'crypto';
import { writeFile, mkdir, rm } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray, sql } from 'drizzle-orm';
import { reachable, seedDatabase } from './helpers/db.js';

/*
  Guest sessions against the in-process database: a guest is a session and never a login, the merge into an account
  moves what the guest owns inside one transaction and lets extensions do the same through `guest:merged`, an idle
  guest is cleaned up through `guest:expired`, and the middleware and the login routes set and clear the cookie.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, userGroup, session, hook, notification, notificationRecipient, notificationGuestRecipient, guestSession } = await load('server/db/schema.js');
const sdk = await load('server/sdk.js');
const { restrictGuest, removeUserFromGroup, RESTRICTED_COOKIE, createUser, deleteUser, addUserToGroup, createHook, createNotification, createGuest, getGuest, mergeGuest, mergeGuestIntoLogin, deleteGuest, listGuests, pruneGuests, getSession, setSetting, GUEST_COOKIE } = sdk;
const cookieOptions = (await load('server/utils/guests/cookieOptions.js')).default;
const currentUserHasPermission = (await load('server/utils/permissions/currentUserHasPermission.js')).default;
const { SYSTEM_SETTINGS } = await load('server/utils/settings/systemSettings.js');
const { SYSTEM_PERMISSIONS } = await load('server/utils/setup/systemPermissions.js');
const middlewareFactory = (await load('middleware/kempo.js')).default;
const { stopScheduler } = await load('server/utils/scheduler/scheduler.js');
const loginRoute = (await load('src/kempo/api/auth/login/email/POST.js')).default;
const registerRoute = (await load('src/kempo/api/auth/register/email/POST.js')).default;
const guestRoute = (await load('src/kempo/api/guest/GET.js')).default;
const adminListRoute = (await load('src/kempo/api/admin/guests/GET.js')).default;
const adminDeleteRoute = (await load('src/kempo/api/admin/guests/[token]/DELETE.js')).default;

const databaseReachable = await reachable(db);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const OWNER = 'guest-test';
const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = 'GuestTest123!';
const EMAILS = ['alice', 'bob', 'admin', 'viewer', 'carol'].map(name => `guest-${name}@test.local`);

const state = { ids: {}, tokens: [], notifications: [], tmp: path.join(root, 'tests', '.tmp-guests'), handler: null, middleware: null };

const resetSettings = async () => {
  await setSetting('system', 'guest_session_days', 30, 'number');
  await setSetting('system', 'guest_idle_days', 60, 'number');
  await setSetting('system', 'require_email_verification', false, 'boolean');
};

const purge = async () => {
  if(state.tokens.length) await db.delete(guestSession).where(inArray(guestSession.token, state.tokens)).catch(() => {});
  await db.delete(notification).where(eq(notification.owner, OWNER)).catch(() => {});
  await db.delete(notification).where(eq(notification.owner, `${OWNER}-hook`)).catch(() => {});
  await db.delete(hook).where(eq(hook.owner, OWNER)).catch(() => {});
  await resetSettings();
  await db.execute(sql`delete from email where recipient = 'guest-carol-verify@test.local'`).catch(() => {});
  for(const email of [...EMAILS, 'guest-register@test.local']){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
};

const newGuest = async ({ idleDays } = {}) => {
  const [error, created] = await createGuest();
  expect(error === null, `createGuest failed: ${JSON.stringify(error)}`);
  state.tokens.push(created.token);
  if(idleDays !== undefined){
    await db.update(guestSession).set({ lastSeenAt: new Date(Date.now() - idleDays * DAY) }).where(eq(guestSession.token, created.token));
  }
  return created.token;
};

const guestRow = async token => (await db.select().from(guestSession).where(eq(guestSession.token, token)))[0];

const notify = async (title, userIds = []) => {
  const [error, result] = await createNotification({ owner: OWNER, title, userIds, dedupeKey: title });
  expect(error === null, `createNotification failed: ${JSON.stringify(error)}`);
  if(!result.notification){
    const [row] = await db.insert(notification).values({ id: crypto.randomUUID(), owner: OWNER, title, dedupeKey: title, createdAt: new Date(), updatedAt: new Date() }).returning();
    state.notifications.push(row.id);
    return row;
  }
  state.notifications.push(result.notification.id);
  return result.notification;
};

const sendToGuest = (notificationId, guestSessionId, fields = {}) => db.insert(notificationGuestRecipient).values({ notificationId, guestSessionId, ...fields });

const held = async (userId, notificationId) => (await db.select().from(notificationRecipient).where(eq(notificationRecipient.userId, userId))).find(row => row.notificationId === notificationId);

const response = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: [],
    status: code => { res.statusCode = code; return res; },
    json: body => { res.body = body; return res; },
    send: body => { res.body = body; return res; },
    cookie: (name, value, options) => { res.cookies.push({ name, value, options }); },
    headers: {},
    clearCookie: (name, options) => { res.cookies.push({ name, value: '', options: { ...options, maxAge: 0 } }); },
    setHeader: (name, value) => { res.headers[name.toLowerCase()] = value; },
  };
  return res;
};

const request = ({ url = '/', method = 'GET', accept = 'text/html', cookies = {}, body, query = {}, params = {} } = {}) => ({
  url, path: url.split('?')[0], method, headers: { accept }, cookies, body, query, params,
});

const visit = async options => {
  const req = request(options);
  const res = response();
  let passedOn = false;
  await state.middleware(req, res, () => { passedOn = true; });
  return { req, res, passedOn, set: res.cookies.find(cookie => cookie.name === GUEST_COOKIE) };
};

const writeHandler = async () => {
  state.handler = path.join(state.tmp, 'handler.js');
  await mkdir(state.tmp, { recursive: true });
  await writeFile(state.handler, [
    `import { pathToFileURL } from 'url';`,
    `import { eq } from 'drizzle-orm';`,
    `const { notification, guestSession } = await import(pathToFileURL(${JSON.stringify(path.join(root, 'server/db/schema.js'))}).href);`,
    `export default async ({ tx, guestSessionId, userId }) => {`,
    `  const calls = (globalThis.guestHookCalls ??= []);`,
    `  const [row] = await tx.select().from(guestSession).where(eq(guestSession.token, guestSessionId));`,
    `  calls.push({ guestSessionId, userId, mergedIntoUserId: row?.mergedIntoUserId ?? null, hasTx: typeof tx.insert === 'function' });`,
    `  await tx.insert(notification).values({ id: 'guest-hook-' + guestSessionId, owner: ${JSON.stringify(`${OWNER}-hook`)}, title: 'written by a handler', createdAt: new Date(), updatedAt: new Date() });`,
    `  if(globalThis.guestHookMode === 'throw' && (!globalThis.guestHookOnly || globalThis.guestHookOnly === guestSessionId)) throw new Error('handler refused');`,
    `};`,
    '',
  ].join('\n'));
};

const hookMarker = async guestSessionId => (await db.select().from(notification).where(eq(notification.id, `guest-hook-${guestSessionId}`))).length === 1;

const quiet = async run => {
  const original = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = original;
  }
};

const registerHooks = async () => {
  for(const event of ['guest:merged', 'guest:expired']){
    expect(!(await createHook({ owner: OWNER, event, callback: state.handler }))[0], `could not register the ${event} hook`);
  }
};

const unregisterHooks = () => db.delete(hook).where(eq(hook.owner, OWNER));

const buildTests = () => ({
  'setup: fixture users and the middleware': async ({ pass }) => {
    await purge();
    await seedDatabase();

    for(const [key, email] of [['alice', EMAILS[0]], ['bob', EMAILS[1]], ['admin', EMAILS[2]], ['viewer', EMAILS[3]], ['carol', EMAILS[4]]]){
      const [error, created] = await createUser({ name: `Guest ${key}`, email, password: PASSWORD, emailVerified: true });
      expect(!error, `could not create ${key}: ${error?.msg}`);
      state.ids[key] = created.user.id;
    }
    expect(!(await addUserToGroup(state.ids.admin, 'system:Administrators'))[0], 'could not make the admin an administrator');

    await writeHandler();
    state.middleware = middlewareFactory({ rootPath: state.tmp, autoEncryptionKey: false });
    stopScheduler();
    pass();
  },

  'kempo declares the settings and permissions guests need': async ({ pass }) => {
    const settings = Object.fromEntries(SYSTEM_SETTINGS.filter(entry => entry.name.startsWith('guest_')).map(entry => [entry.name, entry.value]));
    expect(settings.guest_session_days === 30 && settings.guest_idle_days === 60, `defaults are 30 and 60: ${JSON.stringify(settings)}`);
    expect(['system:guests:view', 'system:guests:manage'].every(name => SYSTEM_PERMISSIONS.some(entry => entry.name === name)), 'both guest permissions exist');
    pass();
  },

  'a guest is a session with an unguessable token, and it is never a login': async ({ pass }) => {
    const token = await newGuest();
    expect(token.length >= 43 && /^[A-Za-z0-9_-]+$/.test(token), 'the token is 32 random bytes, url-safe');
    expect(token !== await newGuest(), 'two guests never share a token');

    const row = await guestRow(token);
    expect(row.mergedIntoUserId === null && row.mergedAt === null && row.createdAt && row.lastSeenAt, 'a new guest is unmerged');

    const [sessionError] = await getSession({ token });
    expect(sessionError?.code === 404, 'the login session lookup does not find a guest token');
    const [permError, allowed] = await currentUserHasPermission(token, 'system:admin:access');
    expect(permError?.code === 401 && !allowed, 'a guest token never passes a permission check');
    pass();
  },

  'getGuest only moves the last-seen time once a minute, and says so when it did': async ({ pass }) => {
    const token = await newGuest();
    const created = (await guestRow(token)).lastSeenAt;

    const [, quick] = await getGuest({ token, now: new Date(created.getTime() + 30000) });
    expect(quick.touched === false && (await guestRow(token)).lastSeenAt.getTime() === created.getTime(), 'a visit inside a minute writes nothing');

    const later = new Date(created.getTime() + 61000);
    const [, slow] = await getGuest({ token, now: later });
    expect(slow.touched === true && (await guestRow(token)).lastSeenAt.getTime() === later.getTime(), 'a visit after a minute updates it');

    expect((await getGuest({ token: 'nope' }))[0].code === 404, 'an unknown token is a 404');
    expect((await getGuest({ token: '' }))[0].code === 400, 'a missing token is a 400');
    pass();
  },

  'the guest cookie lasts the number of days in the setting, 0 meaning until the browser closes': async ({ pass }) => {
    expect((await cookieOptions())[1].maxAge === 30 * 24 * 3600, 'default 30 days, in seconds');
    await setSetting('system', 'guest_session_days', 7, 'number');
    expect((await cookieOptions())[1].maxAge === 7 * 24 * 3600, 'the setting is read');
    await setSetting('system', 'guest_session_days', 0, 'number');
    expect(!('maxAge' in (await cookieOptions())[1]), '0 is a session cookie');
    await setSetting('system', 'guest_session_days', -4, 'number');
    expect((await cookieOptions())[1].maxAge === 30 * 24 * 3600, 'a nonsense value falls back to the default');
    const options = (await cookieOptions())[1];
    expect(options.httpOnly === true && options.sameSite === 'lax' && options.path === '/', 'httpOnly, lax, site-wide');
    await setSetting('system', 'guest_session_days', 30, 'number');
    pass();
  },

  'merging moves a guest\'s notifications to the user and keeps the first read and the last handled and dismissed': async ({ pass }) => {
    const token = await newGuest();
    const early = new Date('2026-01-01T00:00:00Z');
    const late = new Date('2026-02-01T00:00:00Z');

    const onlyGuest = await notify('only the guest has it');
    const both = await notify('both have it', [state.ids.alice]);
    const alreadyAlice = await notify('alice already dismissed it', [state.ids.alice]);

    await sendToGuest(onlyGuest.id, token, { viewedAt: early });
    await sendToGuest(both.id, token, { viewedAt: early, acknowledgedAt: early, dismissedAt: null });
    await sendToGuest(alreadyAlice.id, token, { viewedAt: null, acknowledgedAt: null, dismissedAt: null });
    await db.update(notificationRecipient).set({ viewedAt: late, acknowledgedAt: late }).where(eq(notificationRecipient.notificationId, both.id));
    await db.update(notificationRecipient).set({ dismissedAt: late }).where(eq(notificationRecipient.notificationId, alreadyAlice.id));

    const [error, result] = await mergeGuest({ guestSessionId: token, userId: state.ids.alice });
    expect(error === null && result.merged === true && result.notifications === 3, `merge: ${JSON.stringify(error ?? result)}`);

    const moved = await held(state.ids.alice, onlyGuest.id);
    expect(moved && moved.viewedAt.getTime() === early.getTime(), 'a notification only the guest had is the user\'s now');
    const combined = await held(state.ids.alice, both.id);
    expect(combined.viewedAt.getTime() === early.getTime(), 'the earliest read is kept');
    expect(combined.acknowledgedAt.getTime() === late.getTime(), 'the latest handled is kept');
    expect((await held(state.ids.alice, alreadyAlice.id)).dismissedAt.getTime() === late.getTime(), 'a dismissal is not undone by the guest not having dismissed it');
    expect((await db.select().from(notificationGuestRecipient).where(eq(notificationGuestRecipient.guestSessionId, token))).length === 0, 'nothing is left on the guest');

    const row = await guestRow(token);
    expect(row.mergedIntoUserId === state.ids.alice && row.mergedAt instanceof Date, 'the guest records where it went');
    pass();
  },

  'a guest is merged once, and a missing guest or user is refused without side effects': async ({ pass }) => {
    const token = await newGuest();
    expect((await mergeGuest({ guestSessionId: token, userId: state.ids.bob }))[0] === null, 'first merge works');
    const [again] = await mergeGuest({ guestSessionId: token, userId: state.ids.alice });
    expect(again.code === 409, 'a second merge is a 409');
    expect((await guestRow(token)).mergedIntoUserId === state.ids.bob, 'and it did not move the guest to someone else');

    expect((await mergeGuest({ guestSessionId: 'missing', userId: state.ids.bob }))[0].code === 404, 'unknown guest is a 404');
    const fresh = await newGuest();
    expect((await mergeGuest({ guestSessionId: fresh, userId: 'missing' }))[0].code === 404, 'unknown user is a 404');
    expect((await guestRow(fresh)).mergedIntoUserId === null, 'and the guest stays unmerged');
    expect((await mergeGuest({ userId: state.ids.bob }))[0].code === 400 && (await mergeGuest({ guestSessionId: fresh }))[0].code === 400, 'both ids are required');
    pass();
  },

  'guest:merged runs inside the merge transaction and sees the merged guest': async ({ pass }) => {
    await registerHooks();
    globalThis.guestHookCalls = [];
    globalThis.guestHookMode = 'ok';
    const token = await newGuest();

    const [error] = await mergeGuest({ guestSessionId: token, userId: state.ids.alice });
    expect(error === null, `merge: ${JSON.stringify(error)}`);

    const [call] = globalThis.guestHookCalls;
    expect(globalThis.guestHookCalls.length === 1 && call.guestSessionId === token && call.userId === state.ids.alice, 'the handler gets the guest id and the user id');
    expect(call.hasTx, 'and the transaction');
    expect(call.mergedIntoUserId === state.ids.alice, 'kempo\'s own moves are already in place when the handler runs');
    expect(await hookMarker(token), 'what the handler wrote through tx is kept');
    await unregisterHooks();
    pass();
  },

  'a handler that throws undoes the whole merge': async ({ pass }) => {
    await registerHooks();
    globalThis.guestHookCalls = [];
    globalThis.guestHookMode = 'throw';
    delete globalThis.guestHookOnly;
    const token = await newGuest();
    const dropped = await notify('merged then rolled back');
    await sendToGuest(dropped.id, token);

    const [error] = await quiet(() => mergeGuest({ guestSessionId: token, userId: state.ids.carol }));
    expect(error?.code === 500, 'a failing handler is a 500');

    const row = await guestRow(token);
    expect(row.mergedIntoUserId === null && row.mergedAt === null, 'the guest is not marked merged');
    expect((await db.select().from(notificationGuestRecipient).where(eq(notificationGuestRecipient.guestSessionId, token))).length === 1, 'the guest still owns its notification');
    expect(!(await held(state.ids.carol, dropped.id)), 'the user did not get it');
    expect(!(await hookMarker(token)), 'and what the handler had written is rolled back too');

    globalThis.guestHookMode = 'ok';
    expect((await mergeGuest({ guestSessionId: token, userId: state.ids.carol }))[0] === null, 'the same guest can be merged once the handler works');
    await unregisterHooks();
    pass();
  },

  'a login whose merge fails is revoked, and one whose guest is already gone goes through': async ({ pass }) => {
    await registerHooks();
    globalThis.guestHookMode = 'throw';
    delete globalThis.guestHookOnly;
    const token = await newGuest();
    const [, signedIn] = await sdk.createSession(state.ids.bob);

    const [error] = await quiet(() => mergeGuestIntoLogin({ guestSessionId: token, userId: state.ids.bob, sessionToken: signedIn.sessionToken }));
    expect(error?.code === 500, 'the login is refused');
    expect((await db.select().from(session).where(eq(session.token, signedIn.sessionToken))).length === 0, 'the session that was just made is revoked');
    expect((await guestRow(token)).mergedIntoUserId === null, 'and the guest is kept');

    const [none, result] = await mergeGuestIntoLogin({ guestSessionId: 'long-gone', userId: state.ids.bob, sessionToken: 'x' });
    expect(none === null && result.merged === false, 'a guest that no longer exists never stops a login');
    const [noGuest, noResult] = await mergeGuestIntoLogin({ guestSessionId: undefined, userId: state.ids.bob });
    expect(noGuest === null && noResult.merged === false, 'no guest cookie at all is fine');
    await unregisterHooks();
    globalThis.guestHookMode = 'ok';
    pass();
  },

  'the login route merges the guest, clears its cookie and sets the login cookie': async ({ pass }) => {
    const token = await newGuest();
    const sent = await notify('welcome back');
    await sendToGuest(sent.id, token);

    const res = response();
    await loginRoute(request({ method: 'POST', cookies: { [GUEST_COOKIE]: token }, body: { email: EMAILS[0], password: PASSWORD } }), res);

    expect(res.statusCode === 200 && res.body.user.id === state.ids.alice, `login: ${res.statusCode} ${JSON.stringify(res.body)}`);
    expect((await guestRow(token)).mergedIntoUserId === state.ids.alice, 'the guest merged into the account');
    expect(await held(state.ids.alice, sent.id), 'its notification is the user\'s');
    expect(res.cookies.some(cookie => cookie.name === GUEST_COOKIE && cookie.value === '' && cookie.options.maxAge === 0), 'the guest cookie is cleared');
    expect(res.cookies.some(cookie => cookie.name === 'session_token' && cookie.value), 'and the login cookie is set');
    pass();
  },

  'a failed login leaves the guest and its cookie alone': async ({ pass }) => {
    const token = await newGuest();
    const res = response();
    await loginRoute(request({ method: 'POST', cookies: { [GUEST_COOKIE]: token }, body: { email: EMAILS[0], password: 'wrong-password' } }), res);

    expect(res.statusCode === 401, 'wrong password is a 401');
    expect((await guestRow(token)).mergedIntoUserId === null, 'the guest is not merged');
    expect(!res.cookies.some(cookie => cookie.name === GUEST_COOKIE), 'and its cookie is untouched');
    pass();
  },

  'a login whose merge fails answers 500, keeps the guest cookie and leaves no session': async ({ pass }) => {
    await registerHooks();
    globalThis.guestHookMode = 'throw';
    delete globalThis.guestHookOnly;
    const token = await newGuest();
    const before = (await db.select().from(session).where(eq(session.userId, state.ids.bob))).length;

    const res = response();
    await quiet(() => loginRoute(request({ method: 'POST', cookies: { [GUEST_COOKIE]: token }, body: { email: EMAILS[1], password: PASSWORD } }), res));

    expect(res.statusCode === 500, 'a 500');
    expect(!res.cookies.some(cookie => cookie.name === 'session_token' || cookie.name === GUEST_COOKIE), 'no login cookie is set and the guest cookie stays');
    expect((await db.select().from(session).where(eq(session.userId, state.ids.bob))).length === before, 'no session was left behind');
    await unregisterHooks();
    globalThis.guestHookMode = 'ok';
    pass();
  },

  'a restricted guest is marked in the browser, and clearing the guest cookie does not undo it': async ({ pass }) => {
    const token = await newGuest();
    expect(!(await restrictGuest({ token }))[0], 'the guest is restricted');

    const first = await visit({ url: '/', cookies: { [GUEST_COOKIE]: token } });
    const marker = first.res.cookies.find(cookie => cookie.name === RESTRICTED_COOKIE);
    expect(first.req.restricted === true && marker?.value === token, 'the visit is restricted and the browser is marked with the guest token');
    expect(marker.options.httpOnly && marker.options.maxAge > 300 * 24 * 60 * 60, 'with a long-lived httpOnly cookie');

    const again = await visit({ url: '/', cookies: { [GUEST_COOKIE]: token, [RESTRICTED_COOKIE]: token } });
    expect(again.req.restricted === true && !again.res.cookies.some(cookie => cookie.name === RESTRICTED_COOKIE), 'a marked browser is not sent the cookie again');

    const cleared = await visit({ url: '/', cookies: { [RESTRICTED_COOKIE]: token } });
    state.tokens.push(cleared.req.guest.token);
    expect(cleared.req.restricted === true && cleared.req.guest.token !== token, 'a browser that cleared its guest cookie gets a new guest but is still restricted');

    const res = response();
    await registerRoute(request({ method: 'POST', cookies: { [RESTRICTED_COOKIE]: token }, body: { email: 'guest-register@test.local', password: PASSWORD, name: 'Nope' } }), res);
    expect(res.statusCode === 403, 'and cannot register');
    expect(!(await db.select().from(user).where(eq(user.email, 'guest-register@test.local'))).length, 'no account is made');

    const fresh = await visit({ url: '/' });
    state.tokens.push(fresh.req.guest.token);
    expect(!fresh.req.restricted, 'a visitor who was never restricted is not');

    await restrictGuest({ token, restricted: false });
    const lifted = await visit({ url: '/', cookies: { [RESTRICTED_COOKIE]: token } });
    state.tokens.push(lifted.req.guest.token);
    expect(!lifted.req.restricted && lifted.res.cookies.some(cookie => cookie.name === RESTRICTED_COOKIE && cookie.options.maxAge === 0), 'lifting the restriction frees the browser and clears the cookie');
    pass();
  },

  'a restricted user is marked on a page they open, and stays restricted as a guest after logging out': async ({ pass }) => {
    const [, signedIn] = await sdk.createSession(state.ids.carol);
    const before = await visit({ url: '/account', cookies: { session_token: signedIn.sessionToken } });
    expect(!before.req.restricted && !before.res.cookies.some(cookie => cookie.name === RESTRICTED_COOKIE), 'a user who is not restricted is not marked');

    expect(!(await addUserToGroup(state.ids.carol, 'system:Restricted'))[0], 'the user is restricted');
    const marked = await visit({ url: '/account', cookies: { session_token: signedIn.sessionToken } });
    const marker = marked.res.cookies.find(cookie => cookie.name === RESTRICTED_COOKIE);
    expect(marked.req.restricted === true && marker?.value, 'their next page marks the browser');
    state.tokens.push(marker.value);

    const loggedOut = await visit({ url: '/', cookies: { [RESTRICTED_COOKIE]: marker.value } });
    state.tokens.push(loggedOut.req.guest.token);
    expect(loggedOut.req.restricted === true, 'after logging out they are a restricted guest');

    const api = await visit({ url: '/kempo/api/guest', accept: 'application/json', cookies: { session_token: signedIn.sessionToken } });
    expect(!api.res.cookies.some(cookie => cookie.name === RESTRICTED_COOKIE), 'an API call does not mark the browser, only a page does');

    await removeUserFromGroup(state.ids.carol, 'system:Restricted');
    const freed = await visit({ url: '/', cookies: { [RESTRICTED_COOKIE]: marker.value } });
    state.tokens.push(freed.req.guest.token);
    expect(!freed.req.restricted, 'taking them out of the group frees the browser');
    await db.delete(session).where(eq(session.token, signedIn.sessionToken));
    pass();
  },

  'registering merges the guest exactly like logging in, except when a verification email is required': async ({ pass }) => {
    const token = await newGuest();
    const sent = await notify('before registering');
    await sendToGuest(sent.id, token);

    const res = response();
    await registerRoute(request({ method: 'POST', cookies: { [GUEST_COOKIE]: token }, body: { email: 'guest-register@test.local', password: PASSWORD, name: 'Registered' } }), res);

    expect(res.statusCode === 200 && res.body.user.email === 'guest-register@test.local', `register: ${res.statusCode} ${JSON.stringify(res.body)}`);
    const row = await guestRow(token);
    expect(row.mergedIntoUserId === res.body.user.id, 'the new account holds what the guest had');
    expect(await held(res.body.user.id, sent.id), 'including its notifications');
    expect(res.cookies.some(cookie => cookie.name === GUEST_COOKIE && cookie.options.maxAge === 0), 'the guest cookie is cleared');

    const sender = path.join(state.tmp, 'sender.js');
    await writeFile(sender, 'export default async () => ({ sent: true });\n');
    await createHook({ owner: OWNER, event: 'email:send', callback: sender });
    await setSetting('system', 'require_email_verification', true, 'boolean');
    const waiting = await newGuest();
    const unverified = response();
    await registerRoute(request({ method: 'POST', cookies: { [GUEST_COOKIE]: waiting }, body: { email: 'guest-carol-verify@test.local', password: PASSWORD, name: 'Waiting' } }), unverified);
    expect(unverified.body?.requiresVerification === true, 'verification is required');
    expect((await guestRow(waiting)).mergedIntoUserId === null && !unverified.cookies.some(cookie => cookie.name === GUEST_COOKIE), 'nobody is logged in yet, so the guest stays until they are');
    const [created] = await db.select().from(user).where(eq(user.email, 'guest-carol-verify@test.local'));
    if(created){
      await db.delete(session).where(eq(session.userId, created.id)).catch(() => {});
      await db.delete(user).where(eq(user.id, created.id)).catch(() => {});
    }
    await unregisterHooks();
    await setSetting('system', 'require_email_verification', false, 'boolean');
    pass();
  },

  'a page request without a cookie starts a guest and sets its cookie': async ({ pass }) => {
    const { req, res, passedOn, set } = await visit({ url: '/' });
    expect(passedOn, 'the request carries on to the rest of kempo');
    expect(req.guest?.token && set?.value === req.guest.token, 'request.guest and the cookie hold the same new token');
    state.tokens.push(req.guest.token);
    expect(set.options.httpOnly && set.options.sameSite === 'lax' && set.options.path === '/' && set.options.maxAge === 30 * 24 * 3600, 'httpOnly, lax, site-wide, 30 days');
    expect(await guestRow(req.guest.token), 'the guest exists in the database');
    expect(res.statusCode === 200, 'and the response is not touched');
    expect(res.headers['cache-control'] === 'private, no-store', 'a response that sets the cookie is never cached by a shared cache');
    pass();
  },

  'only a page request starts a guest, never a file, an API call or a script': async ({ pass }) => {
    const count = async () => (await db.select({ token: guestSession.token }).from(guestSession)).length;
    const before = await count();

    for(const options of [
      { url: '/styles.css', accept: 'text/css,*/*' },
      { url: '/app.js', accept: '*/*' },
      { url: '/photo.png', accept: 'image/png' },
      { url: '/kempo/api/auth/session', accept: 'application/json' },
      { url: '/something', accept: '*/*' },
      { url: '/', method: 'POST' },
    ]){
      const { req, set } = await visit(options);
      expect(!req.guest && !set, `${options.method ?? 'GET'} ${options.url} (${options.accept}) must not start a guest`);
    }

    expect(await count() === before, 'no rows were written');

    const { req } = await visit({ url: '/about.html' });
    expect(req.guest, 'a .html page still counts as a page');
    state.tokens.push(req.guest.token);
    pass();
  },

  'a visitor with a login session does not get a guest': async ({ pass }) => {
    const [, signedIn] = await sdk.createSession(state.ids.carol);
    const { req, set } = await visit({ url: '/account', cookies: { session_token: signedIn.sessionToken } });
    expect(!req.guest && !set, 'no guest for a logged-in visitor');

    const { req: stale, set: staleSet } = await visit({ url: '/', cookies: { session_token: 'expired-or-forged' } });
    expect(stale.guest && staleSet, 'a login cookie that matches no session is not a login, so a guest starts');
    state.tokens.push(stale.guest.token);
    await db.delete(session).where(eq(session.token, signedIn.sessionToken));
    pass();
  },

  'a returning guest is recognised, and the cookie is renewed only when the last-seen time moves': async ({ pass }) => {
    const token = await newGuest();

    const fresh = await visit({ url: '/', cookies: { [GUEST_COOKIE]: token } });
    expect(fresh.req.guest?.token === token && !fresh.set && !fresh.res.headers['cache-control'], 'a visit right after the last one keeps the same guest and sends no new cookie, so the page stays cacheable');

    await db.update(guestSession).set({ lastSeenAt: new Date(Date.now() - 5 * 60000) }).where(eq(guestSession.token, token));
    const stale = await visit({ url: '/', cookies: { [GUEST_COOKIE]: token } });
    expect(stale.req.guest?.token === token && stale.set?.value === token, 'a visit after a few minutes renews the cookie');
    expect(Date.now() - (await guestRow(token)).lastSeenAt.getTime() < 5000, 'and the last-seen time');

    const api = await visit({ url: '/kempo/api/guest', accept: 'application/json', cookies: { [GUEST_COOKIE]: token } });
    expect(api.req.guest?.token === token, 'an API call with the cookie is recognised too');
    pass();
  },

  'a merged or unknown guest cookie is a stranger, and a page request replaces it': async ({ pass }) => {
    const merged = await newGuest();
    await mergeGuest({ guestSessionId: merged, userId: state.ids.carol });

    for(const token of [merged, 'forged-token']){
      const { req, set } = await visit({ url: '/', cookies: { [GUEST_COOKIE]: token } });
      expect(req.guest?.token && req.guest.token !== token && set?.value === req.guest.token, `a page request replaces ${token === merged ? 'a merged' : 'an unknown'} guest`);
      state.tokens.push(req.guest.token);
    }

    const api = await visit({ url: '/kempo/api/guest', accept: 'application/json', cookies: { [GUEST_COOKIE]: merged } });
    expect(!api.req.guest && !api.set, 'an API call is not given a guest for one');
    pass();
  },

  'GET /kempo/api/guest answers for a guest, and 204 otherwise, never revealing the token': async ({ pass }) => {
    const token = await newGuest();

    const known = response();
    await guestRoute(request({ url: '/kempo/api/guest', accept: 'application/json', cookies: { [GUEST_COOKIE]: token } }), known);
    expect(known.statusCode === 200 && known.body.createdAt && !JSON.stringify(known.body).includes(token), 'createdAt, and not the secret');

    for(const cookies of [{}, { [GUEST_COOKIE]: 'unknown' }]){
      const none = response();
      await guestRoute(request({ url: '/kempo/api/guest', accept: 'application/json', cookies }), none);
      expect(none.statusCode === 204, '204 when there is no guest');
    }
    pass();
  },

  'deleting a guest fires guest:expired for an unmerged one only': async ({ pass }) => {
    await registerHooks();
    globalThis.guestHookCalls = [];
    globalThis.guestHookMode = 'ok';
    const unmerged = await newGuest();
    const merged = await newGuest();
    await mergeGuest({ guestSessionId: merged, userId: state.ids.carol });
    globalThis.guestHookCalls = [];
    await db.delete(notification).where(eq(notification.owner, `${OWNER}-hook`));

    expect((await deleteGuest({ token: unmerged }))[0] === null, 'deleted');
    expect(!(await guestRow(unmerged)), 'it is gone');
    expect(globalThis.guestHookCalls.length === 1 && globalThis.guestHookCalls[0].guestSessionId === unmerged, 'guest:expired fired for it');

    expect((await deleteGuest({ token: merged }))[0] === null && !(await guestRow(merged)), 'a merged guest is deleted too');
    expect(globalThis.guestHookCalls.length === 1, 'without announcing it: it owns nothing');
    expect((await deleteGuest({ token: merged }))[0].code === 404, 'deleting it again is a 404');
    await unregisterHooks();
    pass();
  },

  'pruneGuests deletes the idle ones, merged or not, keeps the rest and honours 0': async ({ pass }) => {
    const idle = await newGuest({ idleDays: 61 });
    const idleMerged = await newGuest({ idleDays: 90 });
    await mergeGuest({ guestSessionId: idleMerged, userId: state.ids.carol });
    await db.update(guestSession).set({ lastSeenAt: new Date(Date.now() - 90 * DAY) }).where(eq(guestSession.token, idleMerged));
    const recent = await newGuest({ idleDays: 59 });
    const withNotification = await newGuest({ idleDays: 100 });
    const sent = await notify('goes with its guest');
    await sendToGuest(sent.id, withNotification);

    const [error, result] = await pruneGuests();
    expect(error === null && result.deleted >= 3, `prune: ${JSON.stringify(error ?? result)}`);
    expect(!(await guestRow(idle)) && !(await guestRow(idleMerged)) && !(await guestRow(withNotification)), 'every guest idle more than 60 days is gone');
    expect(await guestRow(recent), 'one idle 59 days is kept');
    expect((await db.select().from(notificationGuestRecipient).where(eq(notificationGuestRecipient.guestSessionId, withNotification))).length === 0, 'what a guest was sent goes with it');
    expect((await db.select().from(notification).where(eq(notification.id, sent.id))).length === 1, 'but not the notification itself');

    const old = await newGuest({ idleDays: 400 });
    expect((await pruneGuests({ days: 0 }))[1].deleted === 0 && await guestRow(old), '0 keeps guests forever');

    await setSetting('system', 'guest_idle_days', 30, 'number');
    expect((await pruneGuests())[1].deleted >= 1 && !(await guestRow(old)) && !(await guestRow(recent)), 'the days come from the setting');
    await setSetting('system', 'guest_idle_days', 60, 'number');
    pass();
  },

  'a handler that refuses one guest keeps it, and the others are still cleaned up': async ({ pass }) => {
    await registerHooks();
    globalThis.guestHookMode = 'throw';
    const stuck = await newGuest({ idleDays: 70 });
    const fine = await newGuest({ idleDays: 70 });
    globalThis.guestHookOnly = stuck;

    const [error, result] = await quiet(() => pruneGuests());
    expect(error === null && result.failed === 1, `prune reports it: ${JSON.stringify(error ?? result)}`);
    expect(await guestRow(stuck), 'the refused guest stays for the next run');
    expect(!(await guestRow(fine)), 'the other one is deleted');
    expect(!(await hookMarker(stuck)), 'and nothing the handler wrote for the refused one was kept');

    delete globalThis.guestHookOnly;
    globalThis.guestHookMode = 'ok';
    expect((await pruneGuests())[1].deleted >= 1 && !(await guestRow(stuck)), 'a later run deletes it once the handler agrees');
    await unregisterHooks();
    pass();
  },

  'listGuests filters, pages and names the user a guest went into': async ({ pass }) => {
    const free = await newGuest();
    const mergedToken = await newGuest();
    await mergeGuest({ guestSessionId: mergedToken, userId: state.ids.viewer });

    const [, all] = await listGuests({ limit: 100 });
    const mergedRow = all.guests.find(row => row.token === mergedToken);
    expect(mergedRow.user.email === EMAILS[3] && mergedRow.user.name === 'Guest viewer', 'a merged guest carries the user');
    expect(all.guests.find(row => row.token === free).user === null, 'an unmerged one has none');
    expect(all.counts.all === all.counts.merged + all.counts.unmerged, 'the counts add up');

    expect((await listGuests({ merged: 'merged', limit: 100 }))[1].guests.every(row => row.mergedIntoUserId), 'merged filter');
    expect((await listGuests({ merged: 'unmerged', limit: 100 }))[1].guests.every(row => !row.mergedIntoUserId), 'unmerged filter');
    const [, page] = await listGuests({ limit: 1, offset: 1 });
    expect(page.guests.length === 1 && page.limit === 1 && page.offset === 1 && page.total === all.total, 'paging');
    expect((await listGuests({ limit: 9999 }))[1].limit === 100, 'the page size is capped');
    const [, ordered] = await listGuests({ limit: 100 });
    expect(ordered.guests.every((row, index, rows) => index === 0 || rows[index - 1].lastSeenAt >= row.lastSeenAt), 'most recently seen first');
    pass();
  },

  'deleting the user a guest was merged into does not break, and leaves the guest unlinked': async ({ pass }) => {
    const [, doomed] = await createUser({ name: 'Doomed', email: 'guest-doomed@test.local', password: PASSWORD, emailVerified: true });
    const token = await newGuest();
    await mergeGuest({ guestSessionId: token, userId: doomed.user.id });

    const [error] = await deleteUser(doomed.user.id);
    expect(error === null, `deleteUser: ${JSON.stringify(error)}`);
    const row = await guestRow(token);
    expect(row && row.mergedIntoUserId === null && row.mergedAt, 'the guest keeps its merged time but no longer points anywhere');
    pass();
  },

  'the admin list and delete need system:guests:view and system:guests:manage': async ({ pass }) => {
    const [, adminSession] = await sdk.createSession(state.ids.admin);
    const [, memberSession] = await sdk.createSession(state.ids.viewer);

    const anonymous = response();
    await adminListRoute(request({ url: '/kempo/api/admin/guests', accept: 'application/json' }), anonymous);
    expect(anonymous.statusCode === 401, 'no session is a 401');

    const asGuest = response();
    await adminListRoute(request({ url: '/kempo/api/admin/guests', accept: 'application/json', cookies: { session_token: await newGuest() } }), asGuest);
    expect(asGuest.statusCode === 401, 'a guest token is not a session');

    const member = response();
    await adminListRoute(request({ url: '/kempo/api/admin/guests', accept: 'application/json', cookies: { session_token: memberSession.sessionToken } }), member);
    expect(member.statusCode === 403, 'a user without the permission is a 403');

    const admin = response();
    await adminListRoute(request({ url: '/kempo/api/admin/guests', accept: 'application/json', cookies: { session_token: adminSession.sessionToken }, query: { limit: '5' } }), admin);
    expect(admin.statusCode === 200 && Array.isArray(admin.body.guests) && admin.body.counts, 'an administrator sees the list');

    const target = await newGuest();
    const refused = response();
    await adminDeleteRoute(request({ method: 'DELETE', url: `/kempo/api/admin/guests/${target}`, accept: 'application/json', cookies: { session_token: memberSession.sessionToken }, params: { token: target } }), refused);
    expect(refused.statusCode === 403 && await guestRow(target), 'delete is refused without the permission');

    const deleted = response();
    await adminDeleteRoute(request({ method: 'DELETE', url: `/kempo/api/admin/guests/${target}`, accept: 'application/json', cookies: { session_token: adminSession.sessionToken }, params: { token: target } }), deleted);
    expect(deleted.statusCode === 200 && !(await guestRow(target)), 'and works with it');

    const missing = response();
    await adminDeleteRoute(request({ method: 'DELETE', url: '/kempo/api/admin/guests/x', accept: 'application/json', cookies: { session_token: adminSession.sessionToken }, params: { token: 'x' } }), missing);
    expect(missing.statusCode === 404, 'an unknown guest is a 404');

    await db.delete(session).where(inArray(session.token, [adminSession.sessionToken, memberSession.sessionToken]));
    pass();
  },
});

export const afterAll = async () => {
  if(databaseReachable){
    await purge();
    await db.delete(user).where(eq(user.email, 'guest-doomed@test.local')).catch(() => {});
  }
  delete globalThis.guestHookCalls;
  delete globalThis.guestHookMode;
  delete globalThis.guestHookOnly;
  await rm(state.tmp, { recursive: true, force: true }).catch(() => {});
};

export default databaseReachable
  ? buildTests()
  : { 'guests (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
