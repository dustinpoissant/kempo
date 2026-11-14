import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, sql } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  The data migration for the new notification state: a site that recorded readAt and handledAt keeps them as viewedAt and
  acknowledgedAt, and what a person had read, handled or dismissed counts as delivered. The old columns are made here, as a
  site that began before this version has them, and taken away again so nothing else sees them.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, notification, notificationRecipient, notificationGuestRecipient, guestSession } = await load('server/db/schema.js');
const { up, meta } = await load('server/db/upgrades/4.15.0-notification-state-timestamps.js');

const databaseReachable = await reachable(db);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const TABLES = ['notificationRecipient', 'notificationGuestRecipient'];
const state = { userId: crypto.randomUUID(), guestToken: crypto.randomBytes(8).toString('hex'), notificationIds: [] };

const addOldColumns = async () => {
  for(const table of TABLES) await db.execute(sql.raw(`alter table "${table}" add column if not exists "readAt" timestamp, add column if not exists "handledAt" timestamp`));
};

const dropOldColumns = async () => {
  for(const table of TABLES) await db.execute(sql.raw(`alter table "${table}" drop column if exists "readAt", drop column if exists "handledAt"`));
};

const cleanUp = async () => {
  for(const id of state.notificationIds) await db.delete(notification).where(eq(notification.id, id)).catch(() => {});
  await db.delete(guestSession).where(eq(guestSession.token, state.guestToken)).catch(() => {});
  await db.delete(user).where(eq(user.id, state.userId)).catch(() => {});
  await dropOldColumns().catch(() => {});
};

const makeNotification = async title => {
  const id = crypto.randomUUID();
  state.notificationIds.push(id);
  await db.insert(notification).values({ id, owner: 'notif-upgrade-test', title, createdAt: new Date(), updatedAt: new Date() });
  return id;
};

const A = new Date('2026-03-01T10:00:00Z');
const B = new Date('2026-03-02T10:00:00Z');
const C = new Date('2026-03-03T10:00:00Z');

const buildTests = () => ({
  'it is described, and does nothing on a site that has no old columns': async ({ pass }) => {
    expect(typeof meta.description === 'string' && meta.description.length > 10 && meta.breaking === false, 'a described migration that the previous version can run against');
    await dropOldColumns();
    await up({ db, sql });
    pass();
  },

  'what was read and handled becomes viewed and acknowledged, and anything acted on counts as delivered': async ({ pass }) => {
    await cleanUp();
    await db.insert(user).values({ id: state.userId, name: 'Upgrade', email: `notif-upgrade-${state.userId}@test.local`, passwordHash: 'x', createdAt: new Date(), updatedAt: new Date() });
    await db.insert(guestSession).values({ token: state.guestToken, createdAt: new Date(), lastSeenAt: new Date() });
    await addOldColumns();

    const readOnly = await makeNotification('read');
    const handled = await makeNotification('handled');
    const dismissed = await makeNotification('dismissed');
    const untouched = await makeNotification('untouched');

    for(const id of [readOnly, handled, dismissed, untouched]){
      await db.insert(notificationRecipient).values({ notificationId: id, userId: state.userId });
    }
    const set = (table, id, columns) => db.execute(sql.raw(`update "${table}" set ${Object.entries(columns).map(([column, value]) => `"${column}" = '${value.toISOString()}'::timestamp`).join(', ')} where "notificationId" = '${id}'`));
    await set('notificationRecipient', readOnly, { readAt: A });
    await set('notificationRecipient', handled, { readAt: A, handledAt: B });
    await set('notificationRecipient', dismissed, { dismissedAt: C });
    await db.insert(notificationGuestRecipient).values({ notificationId: readOnly, guestSessionId: state.guestToken });
    await set('notificationGuestRecipient', readOnly, { readAt: B });

    await up({ db, sql });

    const row = async id => (await db.select().from(notificationRecipient).where(eq(notificationRecipient.notificationId, id)))[0];
    const r = await row(readOnly);
    expect(r.viewedAt?.getTime() === A.getTime() && r.acknowledgedAt === null && r.deliveredAt?.getTime() === A.getTime(), `read: ${JSON.stringify(r)}`);
    const h = await row(handled);
    expect(h.viewedAt?.getTime() === A.getTime() && h.acknowledgedAt?.getTime() === B.getTime() && h.deliveredAt?.getTime() === A.getTime(), `handled: ${JSON.stringify(h)}`);
    const d = await row(dismissed);
    expect(d.viewedAt === null && d.acknowledgedAt === null && d.deliveredAt?.getTime() === C.getTime() && d.dismissedAt?.getTime() === C.getTime(), `dismissed counts as delivered: ${JSON.stringify(d)}`);
    const u = await row(untouched);
    expect(u.viewedAt === null && u.deliveredAt === null, 'something no one acted on is still pending');

    const [guest] = await db.select().from(notificationGuestRecipient).where(eq(notificationGuestRecipient.notificationId, readOnly));
    expect(guest.viewedAt?.getTime() === B.getTime() && guest.deliveredAt?.getTime() === B.getTime(), 'a guest\'s state moves over too');
    pass();
  },

  'a level an older notification had becomes its subtype, so an error is still drawn as an error': async ({ pass }) => {
    const made = [];
    for(const level of ['error', 'warning', 'success', 'info']){
      const id = await makeNotification(`level ${level}`);
      made.push([id, level]);
      await db.execute(sql`update "notification" set "level" = ${level}, "subtype" = null where "id" = ${id}`);
    }
    const kept = await makeNotification('has a subtype');
    await db.execute(sql`update "notification" set "level" = 'error', "subtype" = 'spam' where "id" = ${kept}`);

    await up({ db, sql });

    const subtypeOf = async id => (await db.select({ subtype: notification.subtype }).from(notification).where(eq(notification.id, id)))[0].subtype;
    for(const [id, level] of made){
      expect(await subtypeOf(id) === (level === 'info' ? null : level), `${level} becomes ${await subtypeOf(id)}`);
    }
    expect(await subtypeOf(kept) === 'spam', 'a subtype that was already chosen is kept');
    pass();
  },

  'it is safe to run again, and never overwrites what the new columns already hold': async ({ pass }) => {
    const [existing] = await db.select().from(notificationRecipient).where(eq(notificationRecipient.notificationId, state.notificationIds[1]));
    const later = new Date('2026-04-01T00:00:00Z');
    await db.update(notificationRecipient).set({ viewedAt: later }).where(eq(notificationRecipient.notificationId, state.notificationIds[1]));

    await up({ db, sql });
    await up({ db, sql });

    const [after] = await db.select().from(notificationRecipient).where(eq(notificationRecipient.notificationId, state.notificationIds[1]));
    expect(after.viewedAt.getTime() === later.getTime(), 'a viewedAt set by the new code is kept');
    expect(after.acknowledgedAt.getTime() === existing.acknowledgedAt.getTime(), 'and the rest is the same');
    pass();
  },
});

export const afterAll = async () => {
  if(databaseReachable) await cleanUp();
};

export default databaseReachable
  ? buildTests()
  : { 'notification upgrade (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL') };
