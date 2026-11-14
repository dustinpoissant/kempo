import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, sql } from 'drizzle-orm';
import { seedDatabase } from './helpers/db.js';

/*
  What the people who can read the email log are told when an email has no tries left: a banner that must be acknowledged,
  raised once however many fail, and acknowledged when an email goes through again. It is kempo's, not each email extension's.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { email, hook, group, groupPermission, permission, notification, notificationRecipient } = await load('server/db/schema.js');
const { createUser, addUserToGroup, deleteUser, sendEmail, createHook, setSetting, getNotifications } = await load('server/sdk.js');

const OWNER = 'email-failure-notice-test';
const GROUP = 'email-failure-notice-test:readers';
const TO = 'someone@email-failure.test';
const state = { ids: {} };
let directory;

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const noticesFor = async userId => {
  const [error, result] = await getNotifications({ userId, status: 'all', limit: 100 });
  expect(!error, `getNotifications: ${error?.msg}`);
  return result.notifications.filter(n => n.owner === 'kempo' && n.title === 'An email could not be sent');
};

const sender = async body => {
  const file = path.join(directory, `${crypto.randomUUID()}.mjs`);
  await writeFile(file, `export default async ({ email }) => { ${body} };`);
  const [error] = await createHook({ owner: OWNER, event: 'email:send', callback: file });
  expect(!error, `createHook: ${error?.msg}`);
};

const mail = () => sendEmail({ to: TO, subject: 'Hello', html: '<p>Hi</p>', template: 'verify-email' });

const cleanUp = async () => {
  await db.delete(hook).where(eq(hook.owner, OWNER));
  await db.execute(sql`delete from email where recipient like '%@email-failure.test'`);
  await db.delete(notification).where(eq(notification.dedupeKey, 'email-failing'));
  await db.delete(groupPermission).where(eq(groupPermission.groupName, GROUP)).catch(() => {});
  await db.delete(group).where(eq(group.name, GROUP)).catch(() => {});
  for(const id of Object.values(state.ids)) await deleteUser(id).catch(() => {});
};

export const beforeAll = async () => {
  await seedDatabase();
  directory = await mkdtemp(path.join(os.tmpdir(), 'kempo-email-failure-'));
  await cleanUp();
  state.ids = {};
  await db.insert(permission).values({ name: 'system:emails:read', description: 'test', owner: 'system', createdAt: new Date() }).onConflictDoNothing();
  await db.insert(group).values({ name: GROUP, description: 'test', owner: OWNER, createdAt: new Date() });
  await db.insert(groupPermission).values({ id: crypto.randomUUID(), groupName: GROUP, permissionName: 'system:emails:read', createdAt: new Date() });
  for(const name of ['reader', 'outsider']){
    const [error, created] = await createUser({ name, email: `email-failure-${name}@test.local`, password: 'EmailFailure123!', emailVerified: true });
    expect(!error, `createUser ${name}: ${error?.msg}`);
    state.ids[name] = created.user.id;
  }
  expect(!(await addUserToGroup(state.ids.reader, GROUP))[0], 'the reader joins the group');
  await setSetting('system', 'email_max_retries', 1, 'number', false, 'test');
};

export const afterAll = async () => {
  await cleanUp();
  await setSetting('system', 'email_max_retries', 1, 'number', false, 'test');
  await rm(directory, { recursive: true, force: true });
};

export default {
  'an email that failed but will be tried again raises nothing': async ({ pass }) => {
    const [error] = await mail();
    expect(error?.code === 503, `the first try fails: ${JSON.stringify(error)}`);
    expect((await noticesFor(state.ids.reader)).length === 0, 'there is a retry to come, so nobody is told yet');
    pass();
  },

  'an email with no tries left raises a banner that must be acknowledged, for people who can read the log': async ({ pass }) => {
    await setSetting('system', 'email_max_retries', 0, 'number', false, 'test');
    const [error] = await mail();
    expect(error, 'it failed');

    const [banner, ...rest] = await noticesFor(state.ids.reader);
    expect(banner && rest.length === 0, 'one notification for the reader');
    expect(banner.type === 'banner' && banner.subtype === 'error' && banner.mustAcknowledge === true, `${banner.type}/${banner.subtype}/${banner.mustAcknowledge}`);
    expect(banner.title === 'An email could not be sent' && banner.message.includes('"verify-email"') && banner.message.includes(TO), banner.message);
    expect(banner.actions[0].href === '/admin/emails/', JSON.stringify(banner.actions));
    expect((await noticesFor(state.ids.outsider)).length === 0, 'and nobody without system:emails:read');
    pass();
  },

  'more failures straight after raise nothing more, so an acknowledged banner stays acknowledged': async ({ pass }) => {
    const [banner] = await noticesFor(state.ids.reader);
    await db.update(notificationRecipient).set({ acknowledgedAt: new Date() }).where(eq(notificationRecipient.notificationId, banner.id));

    await mail();
    await mail();

    const notices = await noticesFor(state.ids.reader);
    expect(notices.length === 1 && notices[0].acknowledgedAt, 'it was not re-opened');
    pass();
  },

  'an email that goes through afterwards acknowledges it, so it can be raised again': async ({ pass }) => {
    await db.delete(notification).where(eq(notification.dedupeKey, 'email-failing'));
    await db.delete(hook).where(eq(hook.owner, OWNER));
    await sender("return { sent: true, provider: 'works' };");
    const [sendError] = await mail();
    expect(!sendError, `it went: ${JSON.stringify(sendError)}`);

    await db.delete(hook).where(eq(hook.owner, OWNER));
    const [error] = await mail();
    expect(error, 'it failed again');
    const [banner] = await noticesFor(state.ids.reader);
    expect(banner && banner.acknowledgedAt === null, 'raised again, open, since one went through in between');

    await sender("return { sent: true, provider: 'works' };");
    await mail();
    expect((await noticesFor(state.ids.reader))[0].acknowledgedAt, 'an email that went through acknowledges it');
    pass();
  },
};
