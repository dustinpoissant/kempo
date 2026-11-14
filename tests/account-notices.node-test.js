import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray } from 'drizzle-orm';
import { reachable, seedDatabase } from './helpers/db.js';

/*
  What kempo tells a person about their own account: a password that was changed or reset (a toast that confirms it on
  the next page, and a notice that stays as a record) and an email address that was changed (a banner that stays until
  it is acknowledged). A reset also signs the person in, so it merges their guest like a login does.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, userGroup, session, notification, verificationToken, guestSession, notificationGuestRecipient } = await load('server/db/schema.js');
const sdk = await load('server/sdk.js');
const { createUser, changePassword, resetPassword, updateUser, createGuest, getNotifications, createNotification } = sdk;
const { notifyPasswordChanged } = await load('server/utils/notifications/accountNotices.js');
const resetRoute = (await load('src/kempo/api/auth/reset-password/POST.js')).default;

const databaseReachable = await reachable(db);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const EMAILS = ['one', 'two'].map(name => `account-notices-${name}@test.local`);
const state = { ids: {}, guests: [] };

const purge = async () => {
  for(const email of [...EMAILS, 'account-notices-new@test.local']){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(notification).where(eq(notification.owner, 'kempo')).catch(() => {});
    await db.delete(verificationToken).where(eq(verificationToken.userId, row.id)).catch(() => {});
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
  if(state.guests.length) await db.delete(guestSession).where(inArray(guestSession.token, state.guests)).catch(() => {});
};

const notices = async userId => {
  const [, result] = await getNotifications({ userId, status: 'all', limit: 100 });
  return result.notifications.filter(n => n.owner === 'kempo');
};

const response = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: [],
    status: code => { res.statusCode = code; return res; },
    json: body => { res.body = body; return res; },
    cookie: (name, value, options) => { res.cookies.push({ name, value, options }); },
    clearCookie: (name, options) => { res.cookies.push({ name, value: '', options: { ...options, maxAge: 0 } }); },
  };
  return res;
};

const buildTests = () => ({
  'setup: two users': async ({ pass }) => {
    await purge();
    await seedDatabase();
    for(const [key, email] of [['one', EMAILS[0]], ['two', EMAILS[1]]]){
      const [error, created] = await createUser({ name: `Notices ${key}`, email, password: 'OldPassword123!', emailVerified: true });
      expect(!error, `could not create ${key}: ${error?.msg}`);
      state.ids[key] = created.user.id;
    }
    await db.delete(notification).where(eq(notification.owner, 'kempo'));
    pass();
  },

  'changing a password raises a toast that expires and a notice that stays, for that person only': async ({ pass }) => {
    const [error] = await changePassword(state.ids.one, 'NewPassword123!');
    expect(!error, `changePassword: ${JSON.stringify(error)}`);

    const mine = await notices(state.ids.one);
    const toast = mine.find(n => n.type === 'toast');
    const record = mine.find(n => n.type === 'notice');
    expect(toast && toast.title === 'Password changed' && toast.subtype === 'success' && !toast.mustAcknowledge, `a toast: ${JSON.stringify(mine.map(n => [n.type, n.title]))}`);
    const minutes = (new Date(toast.expiresAt).getTime() - Date.now()) / 60000;
    expect(minutes > 9 && minutes <= 10, `it expires in about ten minutes, not ${minutes}`);
    expect(record && record.title === 'Your password was changed' && record.expiresAt === null && record.actions[0].href === '/forgot-password/', 'a notice that never expires, with a way to take it back');
    expect((await notices(state.ids.two)).length === 0, 'and nobody else is told');
    pass();
  },

  'a password that could not be changed raises nothing': async ({ pass }) => {
    await db.delete(notification).where(eq(notification.owner, 'kempo'));
    const [error] = await changePassword(state.ids.one, '');
    expect(error?.code === 400, 'refused');
    expect((await notices(state.ids.one)).length === 0, 'so nothing is announced');
    pass();
  },

  'resetting a password with the emailed link raises a reset toast and notice': async ({ pass }) => {
    await db.delete(notification).where(eq(notification.owner, 'kempo'));
    const token = crypto.randomBytes(16).toString('hex');
    await db.insert(verificationToken).values({ token, userId: state.ids.two, type: 'password_reset', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() });

    const [error] = await resetPassword({ token, password: 'ResetPassword123!' });
    expect(!error, `resetPassword: ${JSON.stringify(error)}`);
    const titles = (await notices(state.ids.two)).map(n => `${n.type}: ${n.title}`).sort();
    expect(JSON.stringify(titles) === JSON.stringify(['notice: Your password was reset', 'toast: Password reset']), JSON.stringify(titles));

    const [badError] = await resetPassword({ token, password: 'AnotherPassword123!' });
    expect(badError?.code === 400 && (await notices(state.ids.two)).length === 2, 'a used link raises nothing more');
    pass();
  },

  'changing an email address raises a banner that must be acknowledged, once however often it changes': async ({ pass }) => {
    await db.delete(notification).where(eq(notification.owner, 'kempo'));
    const [error] = await updateUser(state.ids.one, { email: 'account-notices-new@test.local' });
    expect(!error, `updateUser: ${JSON.stringify(error)}`);

    const [banner, ...rest] = await notices(state.ids.one);
    expect(banner && rest.length === 0, 'one notification');
    expect(banner.type === 'banner' && banner.subtype === 'warning' && banner.mustAcknowledge === true, 'a warning banner that must be acknowledged');
    expect(banner.message.includes(EMAILS[0]) && banner.message.includes('account-notices-new@test.local'), 'which says what it was and what it is');
    expect(banner.actions[0].href === '/account/', 'and where to look');

    await updateUser(state.ids.one, { email: EMAILS[0] });
    const again = await notices(state.ids.one);
    expect(again.length === 1 && again[0].id === banner.id && again[0].message.includes('account-notices-new@test.local'), 'a second change refreshes the same banner');
    pass();
  },

  'an update that does not change the address, or that fails, raises nothing': async ({ pass }) => {
    await db.delete(notification).where(eq(notification.owner, 'kempo'));
    await updateUser(state.ids.one, { name: 'A new name' });
    await updateUser(state.ids.one, { email: EMAILS[0] });
    await updateUser(state.ids.one, { emailVerified: false });
    const [conflict] = await updateUser(state.ids.one, { email: EMAILS[1] });
    expect(conflict?.code === 409, 'an address already in use is refused');
    expect((await notices(state.ids.one)).length === 0, 'none of those is announced');
    expect((await updateUser('no-such-user', { email: 'x@test.local' }))[0].code === 404, 'an unknown user is a 404');
    pass();
  },

  'a notice that cannot be raised never stops the action it describes': async ({ pass }) => {
    const original = console.error;
    console.error = () => {};
    try {
      await notifyPasswordChanged({ userId: 'no-such-user' });
      await notifyPasswordChanged({ userId: undefined });
    } finally {
      console.error = original;
    }
    pass();
  },

  'a password reset signs the person in, so it merges their guest and clears the guest cookie': async ({ pass }) => {
    const [, guest] = await createGuest();
    state.guests.push(guest.token);
    const [, sent] = await createNotification({ owner: 'account-notices-test', title: 'Before the reset', guestSessionIds: [guest.token] });
    const token = crypto.randomBytes(16).toString('hex');
    await db.insert(verificationToken).values({ token, userId: state.ids.two, type: 'password_reset', expiresAt: new Date(Date.now() + 3600000), createdAt: new Date() });

    const res = response();
    await resetRoute({ body: { token, newPassword: 'RouteReset123!' }, cookies: { kempo_guest: guest.token } }, res);
    expect(res.statusCode === 200 && res.body.user.id === state.ids.two, `reset: ${res.statusCode} ${JSON.stringify(res.body)}`);

    const [row] = await db.select().from(guestSession).where(eq(guestSession.token, guest.token));
    expect(row.mergedIntoUserId === state.ids.two, 'the guest merged into the account');
    expect((await db.select().from(notificationGuestRecipient).where(eq(notificationGuestRecipient.guestSessionId, guest.token))).length === 0, 'what it was sent moved');
    expect(res.cookies.some(cookie => cookie.name === 'kempo_guest' && cookie.options.maxAge === 0), 'the guest cookie is cleared');
    expect(res.cookies.some(cookie => cookie.name === 'session_token' && cookie.value), 'and the login cookie is set');
    await db.delete(notification).where(eq(notification.id, sent.notification.id));
    pass();
  },
});

export const afterAll = async () => {
  if(databaseReachable) await purge();
};

export default databaseReachable
  ? buildTests()
  : { 'account notices (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
