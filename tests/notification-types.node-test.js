import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray } from 'drizzle-orm';
import { reachable, seedDatabase } from './helpers/db.js';

/*
  Notification types: what a notification of each type is allowed to be, who it can be sent to (people and
  guests), how its state moves from pending to dismissed, and what a browser is told to show now, including
  the order, the wait before one that must be acknowledged comes back, and expiry.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, userGroup, session, notification, notificationRecipient, notificationGuestRecipient, guestSession } = await load('server/db/schema.js');
const sdk = await load('server/sdk.js');
const { createUser, deleteUser, createGuest, mergeGuest, createSession, createNotification, getNotifications, getUnreadCount, getPendingNotifications, getNotificationConfig, resolveRecipient, markDelivered, markShown, markViewed, markAllViewed, markAcknowledged, deleteNotification, setSetting } = sdk;

const databaseReachable = await reachable(db);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const OWNER = 'notif-types-test';
const EMAILS = ['alice', 'bob'].map(name => `notif-types-${name}@test.local`);
const state = { ids: {}, guests: [] };

const resetSettings = async () => {
  for(const [name, value] of [['notification_poll_seconds', 10], ['notification_cooldown_seconds', 180], ['notification_toast_seconds', 10], ['notification_banner_seconds', 10]]){
    await setSetting('system', name, value, 'number').catch(() => {});
  }
};

const purge = async () => {
  await db.delete(notification).where(eq(notification.owner, OWNER)).catch(() => {});
  if(state.guests.length) await db.delete(guestSession).where(inArray(guestSession.token, state.guests)).catch(() => {});
  for(const email of EMAILS){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
  await resetSettings();
};

const newGuest = async () => {
  const [error, created] = await createGuest();
  expect(!error, `createGuest: ${error?.msg}`);
  state.guests.push(created.token);
  return created.token;
};

const send = async input => {
  const [error, result] = await createNotification({ owner: OWNER, title: 'Hello', ...input });
  expect(error === null, `createNotification failed: ${JSON.stringify(error)}`);
  return result;
};

const rejects = async (input, code, why) => {
  const [error] = await createNotification({ owner: OWNER, title: 'Hello', userIds: [state.ids.alice], ...input });
  expect(error?.code === code, `${why}: expected ${code}, got ${JSON.stringify(error)}`);
};

const listFor = async (who, options = {}) => {
  const [error, result] = await getNotifications({ ...who, ...options });
  expect(error === null, `getNotifications failed: ${JSON.stringify(error)}`);
  return result;
};

const pending = async (who, now) => {
  const [error, result] = await getPendingNotifications({ ...who, now });
  expect(error === null, `getPendingNotifications failed: ${JSON.stringify(error)}`);
  return result.notifications.map(n => n.title);
};

const row = async id => (await db.select().from(notification).where(eq(notification.id, id)))[0];

const buildTests = () => ({
  'setup: users and guests': async ({ pass }) => {
    await purge();
    await seedDatabase();
    for(const [key, email] of [['alice', EMAILS[0]], ['bob', EMAILS[1]]]){
      const [error, created] = await createUser({ name: `Types ${key}`, email, password: 'NotifTypes123!', emailVerified: true });
      expect(!error, `could not create ${key}: ${error?.msg}`);
      state.ids[key] = created.user.id;
    }
    state.ids.g1 = await newGuest();
    state.ids.g2 = await newGuest();
    pass();
  },

  'a notification with no type is a notice with no priority, no repeat and no expiry': async ({ pass }) => {
    const { notification: saved } = await send({ userIds: [state.ids.alice] });
    expect(saved.type === 'notice' && saved.subtype === null && saved.priority === 0, `defaults: ${saved.type} ${saved.subtype} ${saved.priority}`);
    expect(saved.mustAcknowledge === false && saved.cooldownSeconds === null && saved.displaySeconds === null && saved.expiresAt === null, 'no repeat, no overrides, never expires');
    pass();
  },

  'type, subtype and the numbers are checked, and any word is a valid type': async ({ pass }) => {
    await rejects({ type: '' }, 400, 'an empty type');
    await rejects({ type: 'has space' }, 400, 'a type with a space');
    await rejects({ type: '<script>' }, 400, 'a type that is markup');
    await rejects({ type: 'a'.repeat(51) }, 400, 'a type that is too long');
    await rejects({ subtype: 'bad subtype' }, 400, 'a subtype with a space');
    await rejects({ priority: 1.5 }, 400, 'a fractional priority');
    await rejects({ priority: '5' }, 400, 'a string priority');
    await rejects({ mustAcknowledge: 'yes' }, 400, 'a non-boolean mustAcknowledge');
    await rejects({ cooldownSeconds: -1 }, 400, 'a negative cooldown');
    await rejects({ cooldownSeconds: 1.5 }, 400, 'a fractional cooldown');
    await rejects({ displaySeconds: 0 }, 400, 'a display time of zero');

    const { notification: custom } = await send({ type: 'chat', subtype: 'afk-message', userIds: [state.ids.alice] });
    expect(custom.type === 'chat' && custom.subtype === 'afk-message', 'an extension can use its own type and subtype');
    const { notification: colon } = await send({ type: 'my-ext:alert', subtype: 'unknown.user', userIds: [state.ids.alice] });
    expect(colon.type === 'my-ext:alert', 'colons, dots and dashes are allowed');
    pass();
  },

  'level is the older name for subtype, and a modal always must be acknowledged': async ({ pass }) => {
    const { notification: viaLevel } = await send({ level: 'warning', userIds: [state.ids.alice] });
    expect(viaLevel.subtype === 'warning' && viaLevel.level === 'warning', 'level becomes the subtype');
    const { notification: both } = await send({ level: 'error', subtype: 'spam', userIds: [state.ids.alice] });
    expect(both.subtype === 'spam' && both.level === 'info', 'a subtype wins, and the level an older reader sees is info for a word that is not a level');

    const { notification: modal } = await send({ type: 'modal', userIds: [state.ids.alice] });
    expect(modal.mustAcknowledge === true, 'a modal must be acknowledged without being asked');
    const [item] = (await listFor({ userId: state.ids.alice }, { type: 'modal' })).notifications;
    expect(item.mustAcknowledge === true && item.level === 'info', 'and that is what a reader is shown');
    pass();
  },

  'guests can be recipients: unknown and merged guests are ignored, and nobody reached is not an error': async ({ pass }) => {
    const result = await send({ guestSessionIds: [state.ids.g1, 'no-such-guest'] });
    expect(result.guestSessionIds.length === 1 && result.guestSessionIds[0] === state.ids.g1 && result.recipientIds.length === 0, 'only the real guest is a recipient');
    expect((await db.select().from(notificationGuestRecipient).where(eq(notificationGuestRecipient.notificationId, result.notification.id))).length === 1, 'one guest row');
    expect((await listFor({ guestSessionId: state.ids.g1 })).notifications.some(n => n.id === result.notification.id), 'the guest has it');
    expect((await listFor({ guestSessionId: state.ids.g2 })).notifications.length === 0, 'another guest does not');

    const nobody = await send({ guestSessionIds: ['no-such-guest'] });
    expect(nobody.notification === null && nobody.guestSessionIds.length === 0, 'a guest that is not there is nobody');

    const mergedGuest = await newGuest();
    await mergeGuest({ guestSessionId: mergedGuest, userId: state.ids.bob });
    expect((await send({ guestSessionIds: [mergedGuest] })).notification === null, 'a guest that has merged into an account is not a recipient: send to the account');

    const mixed = await send({ userIds: [state.ids.alice], guestSessionIds: [state.ids.g1] });
    expect(mixed.recipientIds.length === 1 && mixed.guestSessionIds.length === 1, 'people and guests together');
    const [error] = await createNotification({ owner: OWNER, title: 'x', guestSessionIds: 'nope' });
    expect(error?.code === 400, 'guestSessionIds must be an array');
    pass();
  },

  'state moves pending, delivered, viewed, acknowledged, dismissed, and the status filter finds each': async ({ pass }) => {
    const who = { userId: state.ids.alice };
    const { notification: made } = await send({ type: 'toast', title: 'Walkthrough', userIds: [state.ids.alice] });
    const statusOf = async () => (await listFor(who, { status: 'all' })).notifications.find(n => n.id === made.id)?.status;
    const found = async status => (await listFor(who, { status })).notifications.some(n => n.id === made.id);

    expect(await statusOf() === 'pending' && await found('pending') && !await found('delivered'), 'pending at first');
    expect((await markDelivered({ ...who, notificationIds: [made.id] }))[1].updated === 1, 'delivered');
    expect(await statusOf() === 'delivered' && await found('delivered') && !await found('pending'), 'delivered');
    expect((await markViewed({ ...who, notificationId: made.id }))[0] === null, 'viewed');
    expect(await statusOf() === 'viewed' && await found('viewed') && !await found('delivered'), 'viewed');
    expect((await markAcknowledged({ ...who, notificationId: made.id }))[0] === null, 'acknowledged');
    expect(await statusOf() === 'acknowledged' && await found('acknowledged') && !await found('viewed'), 'acknowledged');
    expect((await deleteNotification({ ...who, notificationId: made.id }))[0] === null, 'dismissed');
    expect(await statusOf() === 'dismissed' && await found('dismissed') && !await found('acknowledged'), 'dismissed');
    expect(!await found('active') && await found('all'), 'a dismissed one is not active, but is in the history');
    expect(!(await listFor(who)).notifications.some(n => n.id === made.id), 'the default list leaves it out');

    const [error] = await getNotifications({ ...who, status: 'bogus' });
    expect(error?.code === 400, 'an unknown status is a 400');
    pass();
  },

  'every state change keeps the first time, and viewing, showing and acknowledging also deliver': async ({ pass }) => {
    const who = { userId: state.ids.alice };
    const { notification: made } = await send({ type: 'banner', title: 'Times', userIds: [state.ids.alice] });
    const get = async () => (await listFor(who, { status: 'all' })).notifications.find(n => n.id === made.id);

    await markShown({ ...who, notificationId: made.id });
    const shown = await get();
    expect(shown.lastShownAt instanceof Date && shown.deliveredAt instanceof Date && shown.viewedAt === null, 'showing delivers it, and does not view it');

    await new Promise(resolve => setTimeout(resolve, 15));
    await markViewed({ ...who, notificationId: made.id });
    await markViewed({ ...who, notificationId: made.id });
    const viewed = await get();
    expect(viewed.viewedAt instanceof Date && viewed.deliveredAt.getTime() === shown.deliveredAt.getTime(), 'viewing twice keeps the first view and the first delivery');

    await markAcknowledged({ ...who, notificationId: made.id });
    const acked = await get();
    expect(acked.acknowledgedAt instanceof Date && acked.viewedAt.getTime() === viewed.viewedAt.getTime(), 'acknowledging keeps the time it was viewed');

    const fresh = await send({ type: 'toast', title: 'Acknowledged unseen', userIds: [state.ids.alice] });
    await markAcknowledged({ ...who, notificationId: fresh.notification.id });
    const unseen = (await listFor(who, { status: 'all' })).notifications.find(n => n.id === fresh.notification.id);
    expect(unseen.viewedAt instanceof Date && unseen.deliveredAt instanceof Date, 'acknowledging something not yet seen views and delivers it');

    expect((await markShown({ ...who, notificationId: 'no-such-id' }))[0].code === 404, 'an unknown id is a 404');
    expect((await markViewed({ userId: state.ids.bob, notificationId: made.id }))[0].code === 404, 'someone else cannot touch it');
    expect((await markDelivered({ ...who, notificationIds: [] }))[1].updated === 0, 'delivering nothing is fine');
    expect((await markDelivered({ ...who, notificationIds: 'x' }))[0].code === 400, 'the ids must be an array');
    expect((await markViewed({}))[0].code === 400, 'a person is required');
    pass();
  },

  'a guest has the same state and the same functions as a user': async ({ pass }) => {
    const who = { guestSessionId: state.ids.g2 };
    const { notification: made } = await send({ type: 'toast', title: 'For a guest', guestSessionIds: [state.ids.g2] });
    expect((await pending(who)).includes('For a guest'), 'a guest has it pending');
    await markShown({ ...who, notificationId: made.id });
    await markViewed({ ...who, notificationId: made.id });
    expect(!(await pending(who)).includes('For a guest'), 'viewed, it is no longer pending');
    expect((await getUnreadCount({ ...who, type: 'toast' }))[1].count === 0, 'and not unread');
    expect((await deleteNotification({ ...who, notificationId: made.id }))[0] === null, 'a guest can dismiss it');
    expect((await listFor(who, { status: 'dismissed' })).notifications.length === 1, 'and find it in its history');
    pass();
  },

  'pending: a toast or banner is here until it has been viewed, and a notice never is': async ({ pass }) => {
    const alice = { userId: state.ids.alice };
    for(const type of ['toast', 'banner', 'inline', 'notice']){
      await send({ type, title: `Pending ${type}`, userIds: [state.ids.alice], dedupeKey: `pending-${type}` });
    }
    const titles = await pending(alice);
    for(const type of ['toast', 'banner', 'inline']) expect(titles.includes(`Pending ${type}`), `${type} is pending`);
    expect(!titles.includes('Pending notice'), 'a notice waits in the bell instead');

    const [toast] = (await listFor(alice, { type: 'toast', status: 'pending' })).notifications.filter(n => n.title === 'Pending toast');
    await markViewed({ ...alice, notificationId: toast.id });
    expect(!(await pending(alice)).includes('Pending toast'), 'viewed, it is gone');
    expect((await pending(alice)).includes('Pending banner'), 'the others stay');

    const [banner] = (await listFor(alice, { type: 'banner', status: 'pending' })).notifications.filter(n => n.title === 'Pending banner');
    await markAcknowledged({ ...alice, notificationId: banner.id });
    expect(!(await pending(alice)).includes('Pending banner'), 'acknowledged, it is gone');

    const [inline] = (await listFor(alice, { type: 'inline', status: 'pending' })).notifications.filter(n => n.title === 'Pending inline');
    await deleteNotification({ ...alice, notificationId: inline.id });
    expect(!(await pending(alice)).includes('Pending inline'), 'dismissed, it is gone');
    pass();
  },

  'pending: leaving before it was viewed keeps a toast coming, and showing it does not stop it': async ({ pass }) => {
    const alice = { userId: state.ids.alice };
    const { notification: made } = await send({ type: 'toast', title: 'Left too soon', userIds: [state.ids.alice] });
    await markDelivered({ ...alice, notificationIds: [made.id] });
    await markShown({ ...alice, notificationId: made.id });
    expect((await pending(alice)).includes('Left too soon'), 'delivered and shown, but never viewed: it shows again on the next page');
    pass();
  },

  'pending: a modal comes first, then higher priority, then the one raised earlier': async ({ pass }) => {
    const bob = { userId: state.ids.bob };
    await send({ type: 'banner', title: 'Order early', priority: 0, userIds: [state.ids.bob] });
    await new Promise(resolve => setTimeout(resolve, 10));
    await send({ type: 'toast', title: 'Order later', priority: 0, userIds: [state.ids.bob] });
    await send({ type: 'toast', title: 'Order high', priority: 5, userIds: [state.ids.bob] });
    await send({ type: 'toast', title: 'Order low', priority: -3, userIds: [state.ids.bob] });
    await send({ type: 'modal', title: 'Order modal', priority: -100, userIds: [state.ids.bob] });

    const titles = (await pending(bob)).filter(title => title.startsWith('Order'));
    expect(JSON.stringify(titles) === JSON.stringify(['Order modal', 'Order high', 'Order early', 'Order later', 'Order low']), `order: ${JSON.stringify(titles)}`);
    pass();
  },

  'pending: one that must be acknowledged comes back after its cooldown until it is acknowledged': async ({ pass }) => {
    const alice = { userId: state.ids.alice };
    const { notification: made } = await send({ type: 'banner', title: 'Pester', mustAcknowledge: true, cooldownSeconds: 60, userIds: [state.ids.alice] });
    expect((await pending(alice)).includes('Pester'), 'pending before it is ever shown');

    await markShown({ ...alice, notificationId: made.id });
    expect(!(await pending(alice)).includes('Pester'), 'just shown: not again straight away');
    const shownAt = (await listFor(alice, { status: 'all' })).notifications.find(n => n.id === made.id).lastShownAt;
    expect(!(await pending(alice, new Date(shownAt.getTime() + 59000))).includes('Pester'), 'still waiting at 59 seconds');
    expect((await pending(alice, new Date(shownAt.getTime() + 61000))).includes('Pester'), 'back after its 60 second cooldown');

    await markViewed({ ...alice, notificationId: made.id });
    expect((await pending(alice, new Date(shownAt.getTime() + 61000))).includes('Pester'), 'viewing it does not stop it: only acknowledging does');

    await markAcknowledged({ ...alice, notificationId: made.id });
    expect(!(await pending(alice, new Date(shownAt.getTime() + 3600000))).includes('Pester'), 'acknowledged, it never comes back');
    pass();
  },

  'pending: the cooldown comes from the system setting unless the notification sets its own': async ({ pass }) => {
    const alice = { userId: state.ids.alice };
    const { notification: usual } = await send({ type: 'banner', title: 'Default wait', mustAcknowledge: true, userIds: [state.ids.alice] });
    const { notification: quick } = await send({ type: 'banner', title: 'Own wait', mustAcknowledge: true, cooldownSeconds: 5, userIds: [state.ids.alice] });
    const { notification: never } = await send({ type: 'banner', title: 'No wait', mustAcknowledge: true, cooldownSeconds: 0, userIds: [state.ids.alice] });
    for(const made of [usual, quick, never]) await markShown({ ...alice, notificationId: made.id });
    const base = (await listFor(alice, { status: 'all' })).notifications.find(n => n.id === usual.id).lastShownAt.getTime();

    let titles = await pending(alice, new Date(base + 10000));
    expect(!titles.includes('Default wait') && titles.includes('Own wait') && titles.includes('No wait'), 'at 10 seconds only the shorter ones are back');
    titles = await pending(alice, new Date(base + 179000));
    expect(!titles.includes('Default wait'), 'the default is 180 seconds');
    titles = await pending(alice, new Date(base + 181000));
    expect(titles.includes('Default wait'), 'and it is back after that');

    await setSetting('system', 'notification_cooldown_seconds', 20, 'number');
    titles = await pending(alice, new Date(base + 25000));
    expect(titles.includes('Default wait'), 'changing the setting changes the wait');
    await setSetting('system', 'notification_cooldown_seconds', 180, 'number');
    pass();
  },

  'pending: an extension\'s own type is delivered like any other, but is never drawn by core': async ({ pass }) => {
    const alice = { userId: state.ids.alice };
    await send({ type: 'chat', subtype: 'afk-message', title: 'Chat message', userIds: [state.ids.alice] });
    const [, result] = await getPendingNotifications(alice);
    const chat = result.notifications.find(n => n.title === 'Chat message');
    expect(chat && chat.type === 'chat' && chat.subtype === 'afk-message', 'it is in the list with its type and subtype, for the extension to handle');
    pass();
  },

  'pending: expired, dismissed and other people\'s notifications are never here': async ({ pass }) => {
    const alice = { userId: state.ids.alice };
    await send({ type: 'toast', title: 'Short lived', expiresAt: new Date(Date.now() + 60000), userIds: [state.ids.alice] });
    await send({ type: 'toast', title: 'Only for bob', userIds: [state.ids.bob] });
    expect((await pending(alice)).includes('Short lived'), 'pending before it expires');
    expect(!(await pending(alice, new Date(Date.now() + 120000))).includes('Short lived'), 'gone once it has expired');
    expect(!(await pending(alice)).includes('Only for bob'), 'bob\'s is not alice\'s');
    const expired = await listFor(alice, { status: 'expired' });
    expect(expired.notifications.length === 0, 'it has not expired yet by the clock, so it is not found as expired');
    pass();
  },

  'the status "expired" is by the clock, and an expired notification is not active': async ({ pass }) => {
    const { notification: made } = await send({ type: 'banner', title: 'Soon expired', expiresAt: new Date(Date.now() + 1000), userIds: [state.ids.bob] });
    await db.update(notification).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(notification.id, made.id));
    const who = { userId: state.ids.bob };
    expect((await listFor(who, { status: 'expired' })).notifications.some(n => n.id === made.id && n.expired === true), 'found as expired, and marked so');
    expect(!(await listFor(who)).notifications.some(n => n.id === made.id), 'not in the active list');
    expect(!(await listFor(who, { status: 'pending' })).notifications.some(n => n.id === made.id), 'and not as pending either');
    expect((await listFor(who, { status: 'all' })).notifications.some(n => n.id === made.id), 'it is in the full history until it is pruned');
    pass();
  },

  'lists run highest priority first, filter by type, and count the unviewed of that type': async ({ pass }) => {
    const bob = { userId: state.ids.bob };
    await send({ type: 'notice', title: 'List low', priority: 1, userIds: [state.ids.bob] });
    await send({ type: 'notice', title: 'List high', priority: 9, userIds: [state.ids.bob] });
    await send({ type: 'toast', title: 'List toast', priority: 100, userIds: [state.ids.bob] });

    const notices = await listFor(bob, { type: 'notice' });
    const names = notices.notifications.filter(n => n.title.startsWith('List')).map(n => n.title);
    expect(JSON.stringify(names) === JSON.stringify(['List high', 'List low']), `notices by priority: ${JSON.stringify(names)}`);
    expect(notices.notifications.every(n => n.type === 'notice'), 'only notices');

    const [, all] = await getUnreadCount(bob);
    const [, onlyNotices] = await getUnreadCount({ ...bob, type: 'notice' });
    expect(all.count > onlyNotices.count && onlyNotices.count === notices.unread, 'the count can be limited to a type and agrees with the list');
    expect((await getUnreadCount({ ...bob, type: '<x>' }))[0].code === 400, 'a bad type is a 400');

    const high = notices.notifications.find(n => n.title === 'List high');
    await markAllViewed({ ...bob, type: 'notice' });
    expect((await getUnreadCount({ ...bob, type: 'notice' }))[1].count === 0, 'mark all viewed for notices');
    expect((await getUnreadCount(bob))[1].count > 0, 'and leaves the toasts and banners alone');
    expect(high, 'found');
    pass();
  },

  'acknowledging by owner and dedupe key reaches users and guests': async ({ pass }) => {
    const { notification: made } = await send({ type: 'banner', title: 'Outage', dedupeKey: 'outage', userIds: [state.ids.alice], guestSessionIds: [state.ids.g1] });
    const [, result] = await markAcknowledged({ owner: OWNER, dedupeKey: 'outage' });
    expect(result.updated === 2, `both people: ${result.updated}`);
    expect((await listFor({ userId: state.ids.alice }, { status: 'acknowledged' })).notifications.some(n => n.id === made.id), 'the user acknowledged it');
    expect((await listFor({ guestSessionId: state.ids.g1 }, { status: 'acknowledged' })).notifications.some(n => n.id === made.id), 'and the guest');
    expect((await markAcknowledged({}))[0].code === 400, 'something to find it by is required');
    pass();
  },

  'a dedupe refresh re-opens it for every recipient and takes the new type, priority and repeat rules': async ({ pass }) => {
    const people = { userIds: [state.ids.alice], guestSessionIds: [state.ids.g2] };
    const { notification: first } = await send({ type: 'toast', subtype: 'info', title: 'Refreshing', dedupeKey: 'refresh', priority: 0, ...people });
    const alice = { userId: state.ids.alice };
    const guest = { guestSessionId: state.ids.g2 };
    for(const who of [alice, guest]){
      await markShown({ ...who, notificationId: first.id });
      await markViewed({ ...who, notificationId: first.id });
      await markAcknowledged({ ...who, notificationId: first.id });
      await deleteNotification({ ...who, notificationId: first.id });
    }

    const { notification: second, refreshed } = await send({ type: 'banner', subtype: 'error', title: 'Refreshing', dedupeKey: 'refresh', priority: 7, mustAcknowledge: true, cooldownSeconds: 30, displaySeconds: 3, ...people });
    expect(refreshed === true && second.id === first.id, 'the same notification, refreshed');
    expect(second.type === 'banner' && second.subtype === 'error' && second.priority === 7 && second.mustAcknowledge === true && second.cooldownSeconds === 30 && second.displaySeconds === 3, 'it took everything new');

    for(const who of [alice, guest]){
      const item = (await listFor(who, { status: 'all' })).notifications.find(n => n.id === first.id);
      expect(item.status === 'pending' && item.deliveredAt === null && item.viewedAt === null && item.acknowledgedAt === null && item.dismissedAt === null && item.lastShownAt === null, `re-opened for ${who.userId ? 'the user' : 'the guest'}: ${item.status}`);
    }
    pass();
  },

  'getNotificationConfig reads the four settings, with their defaults and limits': async ({ pass }) => {
    let [, config] = await getNotificationConfig();
    expect(JSON.stringify(config) === JSON.stringify({ pollSeconds: 10, cooldownSeconds: 180, toastSeconds: 10, bannerSeconds: 10 }), `defaults: ${JSON.stringify(config)}`);

    await setSetting('system', 'notification_poll_seconds', 3, 'number');
    await setSetting('system', 'notification_toast_seconds', 20, 'number');
    await setSetting('system', 'notification_banner_seconds', 6, 'number');
    await setSetting('system', 'notification_cooldown_seconds', 60, 'number');
    [, config] = await getNotificationConfig();
    expect(config.pollSeconds === 3 && config.toastSeconds === 20 && config.bannerSeconds === 6 && config.cooldownSeconds === 60, 'changed');

    await setSetting('system', 'notification_poll_seconds', 0, 'number');
    expect((await getNotificationConfig())[1].pollSeconds === 0, '0 turns polling off');
    await setSetting('system', 'notification_poll_seconds', 0.2, 'number');
    expect((await getNotificationConfig())[1].pollSeconds === 1, 'less than a second is a second');
    await setSetting('system', 'notification_poll_seconds', -5, 'number');
    expect((await getNotificationConfig())[1].pollSeconds === 10, 'nonsense falls back to the default');
    await setSetting('system', 'notification_toast_seconds', 0, 'number');
    expect((await getNotificationConfig())[1].toastSeconds === 10, 'a toast of 0 seconds is not allowed');
    await resetSettings();
    pass();
  },

  'resolveRecipient: a login first, then a guest, and a stranger is a 401': async ({ pass }) => {
    const [, signedIn] = await createSession(state.ids.alice);
    const guest = state.ids.g1;

    expect((await resolveRecipient({ sessionToken: signedIn.sessionToken, guestToken: guest }))[1].userId === state.ids.alice, 'a login wins over a guest cookie');
    expect((await resolveRecipient({ guestToken: guest }))[1].guestSessionId === guest, 'a guest cookie alone is a guest');
    expect((await resolveRecipient({ sessionToken: 'expired-or-forged', guestToken: guest }))[1].guestSessionId === guest, 'a login that matches nothing falls back to the guest');
    expect((await resolveRecipient({ sessionToken: 'forged' }))[0].code === 401, 'a forged login alone is a 401');
    expect((await resolveRecipient({ guestToken: 'forged' }))[0].code === 401, 'a forged guest is a 401');
    expect((await resolveRecipient({}))[0].code === 401, 'nothing is a 401');

    const merged = await newGuest();
    await mergeGuest({ guestSessionId: merged, userId: state.ids.bob });
    expect((await resolveRecipient({ guestToken: merged }))[0].code === 401, 'a guest that has merged is no longer a guest');
    await db.delete(session).where(eq(session.token, signedIn.sessionToken));
    pass();
  },

  'merging a guest keeps the first delivery and view and the last acknowledge, dismiss and show': async ({ pass }) => {
    const guest = await newGuest();
    const early = new Date('2026-01-01T00:00:00Z');
    const late = new Date('2026-02-01T00:00:00Z');
    const { notification: made } = await send({ type: 'banner', title: 'Merged state', userIds: [state.ids.bob] });
    await db.insert(notificationGuestRecipient).values({ notificationId: made.id, guestSessionId: guest, deliveredAt: early, viewedAt: early, acknowledgedAt: early, dismissedAt: early, lastShownAt: early });
    await db.update(notificationRecipient).set({ deliveredAt: late, viewedAt: late, acknowledgedAt: late, dismissedAt: late, lastShownAt: late })
      .where(eq(notificationRecipient.notificationId, made.id));

    const [error] = await mergeGuest({ guestSessionId: guest, userId: state.ids.bob });
    expect(!error, `merge: ${JSON.stringify(error)}`);
    const [held] = await db.select().from(notificationRecipient).where(eq(notificationRecipient.notificationId, made.id));
    expect(held.deliveredAt.getTime() === early.getTime() && held.viewedAt.getTime() === early.getTime(), 'the earliest delivery and view');
    expect(held.acknowledgedAt.getTime() === late.getTime() && held.dismissedAt.getTime() === late.getTime() && held.lastShownAt.getTime() === late.getTime(), 'the latest acknowledge, dismiss and show');
    pass();
  },

  'a notification sent to a guest follows them to their account, state and all': async ({ pass }) => {
    const guest = await newGuest();
    const { notification: made } = await send({ type: 'toast', title: 'Follows you', guestSessionIds: [guest] });
    await markShown({ guestSessionId: guest, notificationId: made.id });

    const [error] = await mergeGuest({ guestSessionId: guest, userId: state.ids.alice });
    expect(!error, `merge: ${JSON.stringify(error)}`);
    const item = (await listFor({ userId: state.ids.alice }, { status: 'all' })).notifications.find(n => n.id === made.id);
    expect(item && item.status === 'delivered' && item.lastShownAt instanceof Date, 'the account has it, already delivered and shown');
    expect((await pending({ userId: state.ids.alice })).includes('Follows you'), 'and it is still to be shown, since it was never viewed');
    pass();
  },
});

export const afterAll = async () => {
  if(databaseReachable) await purge();
};

export default databaseReachable
  ? buildTests()
  : { 'notification types (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
