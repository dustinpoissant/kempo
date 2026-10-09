import path from 'path';
import { execFileSync } from 'child_process';
import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq, inArray } from 'drizzle-orm';

/*
  The notification SDK against a real database: who receives what, how read, handled and dismissed state
  stays per person, how a dedupe key refreshes one notification instead of repeating it, and how the
  history stays correct when a person's permissions change or old notifications are pruned.

  Needs a reachable Postgres with kempo's schema applied (npx drizzle-kit push). Skips itself with a
  clear message when there is none.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { user, userGroup, session, group, groupPermission, permission, hook, notification, notificationRecipient } = await load('server/db/schema.js');
const sdk = await load('server/sdk.js');
const addPermissionToGroup = (await load('server/utils/permissions/addPermissionToGroup.js')).default;
const { createUser, createGroup, createPermission, addUserToGroup, removeUserFromGroup, createHook, deleteUser } = sdk;
const { createNotification, getNotifications, getUnreadCount, markRead, markAllRead, markHandled, deleteNotification, pruneNotifications } = sdk;

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const canonical = value => JSON.stringify(value, (key, inner) => (inner && typeof inner === 'object' && !Array.isArray(inner) ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))) : inner));

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const OWNER = 'notif-sdk-test';
const OTHER_OWNER = 'notif-sdk-test-other';
const GROUP = 'notif-sdk-test:Team';
const PERMISSION = 'notif-sdk-test:thing:do';
const EMAILS = ['alice', 'bob', 'carol', 'dave', 'admin'].map(name => `notif-sdk-${name}@test.local`);

const state = { ids: {}, tmp: path.join(root, 'tests', '.tmp-notifications') };

const purge = async () => {
  await db.delete(notification).where(inArray(notification.owner, [OWNER, OTHER_OWNER])).catch(() => {});
  await db.delete(hook).where(eq(hook.owner, OWNER)).catch(() => {});
  for(const email of EMAILS){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
  await db.delete(groupPermission).where(eq(groupPermission.groupName, GROUP)).catch(() => {});
  await db.delete(group).where(eq(group.name, GROUP)).catch(() => {});
  await db.delete(permission).where(eq(permission.name, PERMISSION)).catch(() => {});
};

const send = async (input) => {
  const [error, result] = await createNotification({ owner: OWNER, title: 'Hello', ...input });
  expect(error === null, `createNotification failed: ${JSON.stringify(error)}`);
  return result;
};

const listFor = async (userId, options = {}) => {
  const [error, result] = await getNotifications({ userId, ...options });
  expect(error === null, `getNotifications failed: ${JSON.stringify(error)}`);
  return result;
};

const titlesFor = async (userId, options) => (await listFor(userId, options)).notifications.map(n => n.title);

const rejects = async (input, code, why) => {
  const [error, result] = await createNotification({ owner: OWNER, title: 'Hello', userIds: [state.ids.alice], ...input });
  expect(result === null && error?.code === code, `${why}: expected a ${code}, got ${JSON.stringify([error, result])}`);
};

const buildTests = () => ({
  'fixtures: users, a group that holds a permission, and an administrator': async ({ pass }) => {
    await purge();
    await rm(state.tmp, { recursive: true, force: true }).catch(() => {});
    await mkdir(state.tmp, { recursive: true });

    try {
      execFileSync(process.execPath, [path.join(root, 'scripts', 'init-db.js')], { cwd: root, stdio: 'ignore' });
    } catch(e) {
      throw new Error(`could not seed system groups and permissions: ${e.message}`);
    }

    for(const name of ['alice', 'bob', 'carol', 'dave', 'admin']){
      const [error, created] = await createUser({ name, email: `notif-sdk-${name}@test.local`, password: 'NotifSdk123!', emailVerified: true });
      expect(!error, `could not create ${name}: ${error?.msg}`);
      state.ids[name] = created.user.id;
    }

    await createPermission({ resource: 'thing', action: 'do', description: 'test', owner: 'notif-sdk-test' });
    await createGroup({ name: GROUP, description: 'test', owner: 'notif-sdk-test' });
    await addPermissionToGroup(GROUP, PERMISSION);
    await addUserToGroup(state.ids.alice, GROUP);
    await addUserToGroup(state.ids.bob, GROUP);
    expect(!(await addUserToGroup(state.ids.admin, 'system:Administrators'))[0], 'could not make the admin an administrator');
    pass();
  },

  'the SDK exports every notification function': async ({ pass }) => {
    for(const name of ['createNotification', 'getNotifications', 'getUnreadCount', 'markRead', 'markAllRead', 'markHandled', 'deleteNotification', 'pruneNotifications']){
      expect(typeof sdk[name] === 'function', `${name} is not exported from server/sdk.js`);
    }
    pass();
  },

  'a notification needs an owner, a title, a valid level and somebody to send it to': async ({ pass }) => {
    await rejects({ owner: '' }, 400, 'no owner');
    await rejects({ title: '' }, 400, 'no title');
    await rejects({ title: 'x'.repeat(201) }, 400, 'a title over the limit');
    await rejects({ message: 'x'.repeat(2001) }, 400, 'a message over the limit');
    await rejects({ level: 'catastrophe' }, 400, 'an unknown level');
    await rejects({ dedupeKey: '' }, 400, 'an empty dedupe key');
    await rejects({ expiresAt: new Date(Date.now() - 1000) }, 400, 'an expiry in the past');
    await rejects({ expiresAt: 'not a date' }, 400, 'an expiry that is not a date');
    await rejects({ userIds: undefined }, 400, 'no target at all');
    await rejects({ userIds: 'alice' }, 400, 'userIds that is not an array');
    pass();
  },

  'action links and calls must be paths on this site': async ({ pass }) => {
    const bad = [
      [{ label: 'Go', href: 'https://evil.test/' }, 'an absolute URL'],
      [{ label: 'Go', href: 'javascript:alert(1)' }, 'a javascript: URL'],
      [{ label: 'Go', href: '//evil.test/path' }, 'a protocol-relative URL'],
      [{ label: 'Go', href: '/\\evil.test' }, 'a slash and a backslash'],
      [{ label: 'Go', href: '/ok\n/evil' }, 'a path with a newline'],
      [{ label: 'Go', href: 'relative/path' }, 'a relative path'],
      [{ label: 'Go', href: '' }, 'an empty path'],
      [{ label: 'Go', href: '/' + 'a'.repeat(3000) }, 'an over-long path'],
      [{ label: 'Go', api: { method: 'POST', url: 'https://evil.test/x' } }, 'an absolute api url'],
      [{ label: 'Go', api: { method: 'POST', url: '//evil.test/x' } }, 'a protocol-relative api url'],
      [{ label: 'Go', api: { method: 'GET', url: '/x' } }, 'a GET api action'],
      [{ label: 'Go', api: { method: 'TRACE', url: '/x' } }, 'an unknown method'],
      [{ label: 'Go', api: { url: '/x' } }, 'an api action with no method'],
      [{ label: 'Go', api: { method: 'POST', url: '/x', body: 'y'.repeat(5000) } }, 'a huge body'],
      [{ label: 'Go', href: '/a', api: { method: 'POST', url: '/x' } }, 'both href and api'],
      [{ label: 'Go' }, 'neither href nor api'],
      [{ href: '/a' }, 'no label'],
      [{ label: 'x'.repeat(41), href: '/a' }, 'an over-long label'],
      ['/a', 'an action that is not an object'],
    ];
    for(const [action, why] of bad) await rejects({ actions: [action] }, 400, why);
    await rejects({ actions: Array.from({ length: 4 }, () => ({ label: 'Go', href: '/a' })) }, 400, 'too many actions');
    await rejects({ actions: 'nope' }, 400, 'actions that is not an array');

    const { notification: saved } = await send({
      userIds: [state.ids.alice],
      dedupeKey: 'actions-ok',
      actions: [
        { label: 'Open', href: '/admin/notifications?x=1#top', extra: 'dropped' },
        { label: 'Retry', api: { method: 'post', url: '/kempo/api/thing/retry', body: { id: 7 }, headers: { x: 'dropped' } } }
      ]
    });
    expect(canonical(saved.actions) === canonical([
      { label: 'Open', href: '/admin/notifications?x=1#top' },
      { label: 'Retry', api: { method: 'POST', url: '/kempo/api/thing/retry', body: { id: 7 } } }
    ]), `actions should be stored reduced to known fields with the method upper-cased, got ${JSON.stringify(saved.actions)}`);
    pass();
  },

  'sending to user ids reaches those users and ignores ids that do not exist': async ({ pass }) => {
    const result = await send({ title: 'To alice and bob', message: 'body', level: 'warning', userIds: [state.ids.alice, state.ids.bob, 'no-such-user', state.ids.alice] });
    expect(result.recipientIds.length === 2 && result.refreshed === false, `expected two recipients, got ${JSON.stringify(result)}`);
    expect(result.notification.owner === OWNER && result.notification.level === 'warning', 'the stored fields should come back');

    const alice = await listFor(state.ids.alice);
    const item = alice.notifications.find(n => n.title === 'To alice and bob');
    expect(item && item.message === 'body' && item.level === 'warning' && item.readAt === null && item.handledAt === null, `alice should have it unread, got ${JSON.stringify(item)}`);
    expect((await titlesFor(state.ids.carol)).length === 0, 'carol was not a recipient');
    pass();
  },

  'sending to a permission reaches its holders through groups, and every administrator': async ({ pass }) => {
    await send({ title: 'By permission', permission: PERMISSION });
    expect((await titlesFor(state.ids.alice)).includes('By permission'), 'alice holds it through the group');
    expect((await titlesFor(state.ids.bob)).includes('By permission'), 'bob holds it through the group');
    expect((await titlesFor(state.ids.admin)).includes('By permission'), 'administrators hold every permission');
    expect(!(await titlesFor(state.ids.carol)).includes('By permission'), 'carol holds nothing');
    pass();
  },

  'sending to a group reaches its members only, and the union is deduplicated': async ({ pass }) => {
    const result = await send({ title: 'By group', group: GROUP, userIds: [state.ids.alice, state.ids.carol], permission: PERMISSION });
    expect(result.recipientIds.length === 4, `alice, bob, carol and the administrator should be the four recipients, got ${result.recipientIds.length}`);
    expect(new Set(result.recipientIds).size === 4, 'a person who matches several targets must be a recipient once');

    const groupOnly = await send({ title: 'Group only', group: GROUP });
    expect(groupOnly.recipientIds.length === 2, `a group send reaches its two members, not the administrator, got ${groupOnly.recipientIds.length}`);
    pass();
  },

  'targets that resolve to nobody are not an error and store nothing': async ({ pass }) => {
    const before = (await db.select({ n: sql`count(*)`.mapWith(Number) }).from(notification).where(eq(notification.owner, OWNER)))[0].n;
    for(const target of [{ userIds: [] }, { userIds: ['no-such-user'] }, { group: 'notif-sdk-test:Nobody' }, { permission: 'notif-sdk-test:nothing:holds' }]){
      const [error, result] = await createNotification({ owner: OWNER, title: 'Nobody', ...target });
      if(target.permission){
        // Administrators hold every permission, so this one reaches them. Anyone else would be a bug.
        expect(error === null && result.recipientIds.length === 1 && result.recipientIds[0] === state.ids.admin, `an unheld permission should reach only the administrator, got ${JSON.stringify([error, result])}`);
        continue;
      }
      expect(error === null && result.notification === null && result.recipientIds.length === 0, `expected an empty result, got ${JSON.stringify([error, result])}`);
    }
    const after = (await db.select({ n: sql`count(*)`.mapWith(Number) }).from(notification).where(eq(notification.owner, OWNER)))[0].n;
    expect(after === before + 1, `only the administrator send should have stored a row, ${after - before} were stored`);
    pass();
  },

  'history survives losing the permission, and newcomers do not inherit it': async ({ pass }) => {
    await send({ title: 'Before the change', permission: PERMISSION });
    expect(!(await removeUserFromGroup(state.ids.bob, GROUP))[0], 'could not remove bob from the group');
    expect((await titlesFor(state.ids.bob)).includes('Before the change'), 'bob must still see what was sent while he held the permission');

    await send({ title: 'After the change', permission: PERMISSION });
    expect(!(await titlesFor(state.ids.bob)).includes('After the change'), 'bob no longer holds it, so does not receive new ones');

    await addUserToGroup(state.ids.dave, GROUP);
    expect(!(await titlesFor(state.ids.dave)).includes('Before the change'), 'dave joined later and must not be handed the past');
    expect((await titlesFor(state.ids.dave)).length === 0, 'dave has nothing yet');
    await send({ title: 'For the new member', permission: PERMISSION });
    expect((await titlesFor(state.ids.dave)).includes('For the new member'), 'but he gets what is sent now');

    await removeUserFromGroup(state.ids.dave, GROUP);
    await addUserToGroup(state.ids.bob, GROUP);
    pass();
  },

  'read state is per person, idempotent, and cannot be touched by someone else': async ({ pass }) => {
    const { notification: saved } = await send({ title: 'Read me', userIds: [state.ids.alice, state.ids.bob] });
    const aliceBefore = await getUnreadCount({ userId: state.ids.alice });
    expect(aliceBefore[0] === null && aliceBefore[1].count >= 1, 'alice has unread notifications');

    // carol was never a recipient: not found, and nothing changed for the real recipients
    const [foreignError] = await markRead({ userId: state.ids.carol, notificationId: saved.id });
    expect(foreignError?.code === 404, `a non-recipient should get a 404, got ${JSON.stringify(foreignError)}`);
    expect((await listFor(state.ids.alice)).notifications.find(n => n.id === saved.id).readAt === null, 'a foreign attempt must not read it for alice');

    expect(!(await markRead({ userId: state.ids.alice, notificationId: saved.id }))[0], 'alice could not mark it read');
    const readAt = (await listFor(state.ids.alice)).notifications.find(n => n.id === saved.id).readAt;
    expect(readAt instanceof Date, 'alice should now have a readAt');
    expect((await listFor(state.ids.bob)).notifications.find(n => n.id === saved.id).readAt === null, 'bob still has it unread');

    await wait(15);
    await markRead({ userId: state.ids.alice, notificationId: saved.id });
    expect((await listFor(state.ids.alice)).notifications.find(n => n.id === saved.id).readAt.getTime() === readAt.getTime(), 'reading twice keeps the first read time');

    expect((await markRead({ userId: state.ids.alice, notificationId: 'no-such-id' }))[0].code === 404, 'an unknown id is a 404');
    expect((await markRead({ userId: state.ids.alice }))[0].code === 400, 'a missing id is a 400');
    pass();
  },

  'unreadOnly filters the list, totals describe the filter, and unread is always the full count': async ({ pass }) => {
    await markAllRead({ userId: state.ids.carol });
    await send({ title: 'carol 1', userIds: [state.ids.carol] });
    await send({ title: 'carol 2', userIds: [state.ids.carol] });
    const { notification: third } = await send({ title: 'carol 3', userIds: [state.ids.carol] });
    await markRead({ userId: state.ids.carol, notificationId: third.id });

    const all = await listFor(state.ids.carol);
    expect(all.total === all.notifications.length && all.total >= 3 && all.unread === 2, `expected 2 unread, got ${all.unread} of ${all.total}`);
    const unread = await listFor(state.ids.carol, { unreadOnly: true });
    expect(unread.total === 2 && unread.unread === 2 && unread.notifications.every(n => n.readAt === null), 'the unread view lists only unread ones');

    const page = await listFor(state.ids.carol, { limit: 1, offset: 1 });
    expect(page.notifications.length === 1 && page.total === all.total && page.limit === 1 && page.offset === 1, 'paging keeps the overall total');
    expect(page.notifications[0].id === all.notifications[1].id, 'offset 1 is the second item');
    expect((await listFor(state.ids.carol, { limit: 100000 })).limit === 100, 'the page size is capped at 100');
    expect((await getNotifications({}))[0].code === 400, 'a user id is required');

    expect((await markAllRead({ userId: state.ids.carol }))[1].updated === 2, 'mark all read touches only the two unread');
    expect((await getUnreadCount({ userId: state.ids.carol }))[1].count === 0, 'nothing is left unread');
    pass();
  },

  'newest first: a refreshed notification moves to the top': async ({ pass }) => {
    await send({ title: 'older', userIds: [state.ids.dave], dedupeKey: 'order-a' });
    await wait(10);
    await send({ title: 'newer', userIds: [state.ids.dave], dedupeKey: 'order-b' });
    expect((await titlesFor(state.ids.dave))[0] === 'newer', 'the latest comes first');
    await wait(10);
    await send({ title: 'older, again', userIds: [state.ids.dave], dedupeKey: 'order-a' });
    expect(JSON.stringify((await titlesFor(state.ids.dave)).slice(0, 2)) === JSON.stringify(['older, again', 'newer']), 'raising the older one again puts it first');
    pass();
  },

  'handled marks the action done and reads it, by id or by owner and dedupe key': async ({ pass }) => {
    const { notification: saved } = await send({ title: 'Do it', userIds: [state.ids.alice, state.ids.bob], dedupeKey: 'handle-me' });

    expect((await markHandled({ userId: state.ids.carol, notificationId: saved.id }))[0].code === 404, 'a non-recipient gets a 404');
    expect((await markHandled({}))[0].code === 400, 'something to identify the notification is required');

    expect(!(await markHandled({ userId: state.ids.alice, notificationId: saved.id }))[0], 'alice could not mark it handled');
    const alice = (await listFor(state.ids.alice)).notifications.find(n => n.id === saved.id);
    expect(alice.handledAt instanceof Date && alice.readAt instanceof Date, 'handled implies read');
    expect((await listFor(state.ids.bob)).notifications.find(n => n.id === saved.id).handledAt === null, 'bob has not handled it');

    const [error, result] = await markHandled({ owner: OWNER, dedupeKey: 'handle-me' });
    expect(error === null && result.updated === 2, `resolving by key updates every recipient, got ${JSON.stringify([error, result])}`);
    expect((await listFor(state.ids.bob)).notifications.find(n => n.id === saved.id).handledAt instanceof Date, 'bob is now handled too');
    expect((await markHandled({ owner: OWNER, dedupeKey: 'no-such-key' }))[1].updated === 0, 'resolving a key nobody holds is not an error');
    pass();
  },

  'a dedupe key refreshes one notification in place instead of repeating it': async ({ pass }) => {
    const first = await send({ title: 'Thumbnail failed', message: 'attempt 1', level: 'warning', userIds: [state.ids.alice, state.ids.bob], dedupeKey: 'thumb:42' });
    expect(first.refreshed === false, 'the first one is new');

    const second = await send({ title: 'Thumbnail failed', message: 'attempt 2', level: 'error', userIds: [state.ids.alice, state.ids.bob], dedupeKey: 'thumb:42' });
    expect(second.refreshed === true && second.notification.id === first.notification.id, 'the same notification, refreshed');
    expect(second.notification.createdAt.getTime() === first.notification.createdAt.getTime(), 'createdAt is when it was first raised');
    expect(second.notification.updatedAt.getTime() > first.notification.updatedAt.getTime(), 'updatedAt is when it was last raised');

    const rows = await db.select().from(notification).where(eq(notification.dedupeKey, 'thumb:42'));
    expect(rows.length === 1 && rows[0].message === 'attempt 2' && rows[0].level === 'error', 'one row, holding the latest content');
    const recipients = await db.select().from(notificationRecipient).where(eq(notificationRecipient.notificationId, first.notification.id));
    expect(recipients.length === 2, 'and still one row per recipient');
    expect((await listFor(state.ids.alice)).notifications.filter(n => n.id === first.notification.id).length === 1, 'alice sees it once');
    pass();
  },

  'raising a deduped notification again re-opens it: unread, not handled, not dismissed': async ({ pass }) => {
    const input = { title: 'Failed again', userIds: [state.ids.alice, state.ids.bob], dedupeKey: 'reopen' };
    const { notification: saved } = await send(input);
    const find = async userId => (await listFor(userId)).notifications.find(n => n.id === saved.id);

    // alice read and handled it; bob dismissed it
    await markHandled({ userId: state.ids.alice, notificationId: saved.id });
    await deleteNotification({ userId: state.ids.bob, notificationId: saved.id });
    expect(await find(state.ids.bob) === undefined, 'bob dismissed it');

    await send({ ...input, message: 'it failed once more' });
    const alice = await find(state.ids.alice);
    const bob = await find(state.ids.bob);
    expect(alice.readAt === null && alice.handledAt === null && alice.message === 'it failed once more', 'a read, handled one comes back unread and not handled');
    expect(bob && bob.readAt === null, 'a dismissed one comes back too, because it is a new occurrence');

    // while it is unread, a repeat just updates it
    const again = await send({ ...input, message: 'and again' });
    expect(again.refreshed === true && (await find(state.ids.alice)).message === 'and again', 'an unread one is updated in place');
    expect((await listFor(state.ids.alice)).unread >= 1, 'and is still counted once');
    pass();
  },

  'a repeat to different people adds them and leaves the earlier recipients alone': async ({ pass }) => {
    const { notification: saved } = await send({ title: 'Widening', userIds: [state.ids.alice], dedupeKey: 'widen' });
    await markRead({ userId: state.ids.alice, notificationId: saved.id });
    await send({ title: 'Widening', userIds: [state.ids.carol], dedupeKey: 'widen' });
    expect((await listFor(state.ids.alice)).notifications.find(n => n.id === saved.id).readAt instanceof Date, 'alice was not a recipient the second time, so her state is untouched');
    expect((await titlesFor(state.ids.carol)).includes('Widening'), 'carol is added');
    pass();
  },

  'the dedupe key belongs to its owner, and no key means no dedupe': async ({ pass }) => {
    const mine = await send({ title: 'Same key', userIds: [state.ids.alice], dedupeKey: 'shared-key' });
    const [error, theirs] = await createNotification({ owner: OTHER_OWNER, title: 'Same key', userIds: [state.ids.alice], dedupeKey: 'shared-key' });
    expect(error === null && theirs.notification.id !== mine.notification.id && theirs.refreshed === false, 'another owner using the same key is a separate notification');

    const a = await send({ title: 'No key', userIds: [state.ids.alice] });
    const b = await send({ title: 'No key', userIds: [state.ids.alice] });
    expect(a.notification.id !== b.notification.id, 'without a key every call is its own notification');
    pass();
  },

  'concurrent raises of one key leave a single notification': async ({ pass }) => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => createNotification({ owner: OWNER, title: `race ${i}`, userIds: [state.ids.alice], dedupeKey: 'race' })));
    expect(results.every(([error]) => error === null), `every concurrent call should succeed, got ${JSON.stringify(results.map(r => r[0]))}`);
    const rows = await db.select().from(notification).where(eq(notification.dedupeKey, 'race'));
    expect(rows.length === 1, `expected one row, got ${rows.length}`);
    pass();
  },

  'dismissing hides it for one person only; deleting for everyone removes it': async ({ pass }) => {
    const { notification: saved } = await send({ title: 'Dismiss me', userIds: [state.ids.alice, state.ids.bob] });

    expect((await deleteNotification({ userId: state.ids.carol, notificationId: saved.id }))[0].code === 404, 'a non-recipient cannot dismiss');
    expect((await deleteNotification({ notificationId: saved.id }))[0].code === 400, 'a person is required unless deleting for everyone');
    expect(!(await deleteNotification({ userId: state.ids.alice, notificationId: saved.id }))[0], 'alice could not dismiss it');
    expect(!(await titlesFor(state.ids.alice)).includes('Dismiss me'), 'gone from alice\'s list');
    expect((await titlesFor(state.ids.bob)).includes('Dismiss me'), 'still in bob\'s');
    const unread = await getUnreadCount({ userId: state.ids.alice });
    expect(unread[0] === null, 'the count still works');
    expect((await db.select().from(notification).where(eq(notification.id, saved.id))).length === 1, 'the stored notification is kept');

    expect(!(await deleteNotification({ notificationId: saved.id, everyone: true }))[0], 'could not delete for everyone');
    expect(!(await titlesFor(state.ids.bob)).includes('Dismiss me'), 'gone for bob too');
    expect((await db.select().from(notificationRecipient).where(eq(notificationRecipient.notificationId, saved.id))).length === 0, 'their per-person state went with it');
    expect((await deleteNotification({ notificationId: saved.id, everyone: true }))[0].code === 404, 'deleting twice is a 404');
    pass();
  },

  'deleting a user removes their notification state and nobody else\'s': async ({ pass }) => {
    const { notification: saved } = await send({ title: 'Two people', userIds: [state.ids.carol, state.ids.dave] });
    const [error] = await deleteUser(state.ids.carol);
    expect(error === null, `could not delete carol: ${JSON.stringify(error)}`);
    const remaining = await db.select().from(notificationRecipient).where(eq(notificationRecipient.notificationId, saved.id));
    expect(remaining.length === 1 && remaining[0].userId === state.ids.dave, 'only dave keeps a row');
    pass();
  },

  'an expired notification disappears from lists and counts, then is pruned': async ({ pass }) => {
    const { notification: saved } = await send({ title: 'Short lived', userIds: [state.ids.alice], expiresAt: new Date(Date.now() + 700) });
    expect((await titlesFor(state.ids.alice)).includes('Short lived'), 'visible before it expires');
    await wait(900);
    expect(!(await titlesFor(state.ids.alice)).includes('Short lived'), 'hidden once expired');

    const [error, result] = await pruneNotifications({ retentionDays: 0 });
    expect(error === null && result.deleted >= 1, `pruning should delete the expired one, got ${JSON.stringify([error, result])}`);
    expect((await db.select().from(notification).where(eq(notification.id, saved.id))).length === 0, 'and the row is gone');
    pass();
  },

  'retention deletes what was last raised before the cutoff, with its per-person state': async ({ pass }) => {
    const old = await send({ title: 'Old news', userIds: [state.ids.alice], dedupeKey: 'old' });
    const fresh = await send({ title: 'Fresh news', userIds: [state.ids.alice], dedupeKey: 'fresh' });
    await db.update(notification).set({ updatedAt: new Date(Date.now() - 100 * 86400000) }).where(eq(notification.id, old.notification.id));

    const [keepError, kept] = await pruneNotifications({ retentionDays: 0 });
    expect(keepError === null && (await db.select().from(notification).where(eq(notification.id, old.notification.id))).length === 1, `0 days keeps history forever, got ${JSON.stringify(kept)}`);

    const [error] = await pruneNotifications({ retentionDays: 90 });
    expect(error === null, 'pruning should succeed');
    expect((await db.select().from(notification).where(eq(notification.id, old.notification.id))).length === 0, 'older than the retention is deleted');
    expect((await db.select().from(notificationRecipient).where(eq(notificationRecipient.notificationId, old.notification.id))).length === 0, 'with its per-person rows');
    expect((await db.select().from(notification).where(eq(notification.id, fresh.notification.id))).length === 1, 'recent ones stay');

    // A refreshed notification counts from when it was last raised, not when it was first
    await db.update(notification).set({ createdAt: new Date(Date.now() - 200 * 86400000) }).where(eq(notification.id, fresh.notification.id));
    await pruneNotifications({ retentionDays: 90 });
    expect((await db.select().from(notification).where(eq(notification.id, fresh.notification.id))).length === 1, 'age is measured from updatedAt');
    pass();
  },

  'the retention setting is honoured when no days are passed': async ({ pass }) => {
    const { notification: saved } = await send({ title: 'Setting driven', userIds: [state.ids.alice], dedupeKey: 'setting' });
    await db.update(notification).set({ updatedAt: new Date(Date.now() - 10 * 86400000) }).where(eq(notification.id, saved.id));

    await pruneNotifications();
    expect((await db.select().from(notification).where(eq(notification.id, saved.id))).length === 1, 'the default of 90 days keeps a 10 day old one');

    await sdk.setSetting('system', 'notification_retention_days', 5, 'number');
    try {
      await pruneNotifications();
      expect((await db.select().from(notification).where(eq(notification.id, saved.id))).length === 0, 'a setting of 5 days removes it');
    } finally {
      await sdk.setSetting('system', 'notification_retention_days', 90, 'number');
    }
    pass();
  },

  'a notification:created hook fires with the notification and its recipients, and a throwing handler breaks nothing': async ({ pass }) => {
    const log = path.join(state.tmp, 'hook.log');
    const good = path.join(state.tmp, 'created.js');
    const bad = path.join(state.tmp, 'created-throws.js');
    await writeFile(good, [
      "import { appendFileSync } from 'fs';",
      "export default data => appendFileSync(" + JSON.stringify(log) + ", JSON.stringify(data) + '\\n');",
      ""
    ].join('\n'));
    await writeFile(bad, "export default () => { throw new Error('handler exploded'); };\n");

    expect(!(await createHook({ owner: OWNER, event: 'notification:created', callback: bad }))[0], 'could not register the throwing hook');
    expect(!(await createHook({ owner: OWNER, event: 'notification:created', callback: good }))[0], 'could not register the hook');

    const originalError = console.error;
    console.error = () => {};
    let result;
    try {
      result = await send({ title: 'Hooked', userIds: [state.ids.alice, state.ids.bob], dedupeKey: 'hooked' });
      await send({ title: 'Hooked', userIds: [state.ids.alice], dedupeKey: 'hooked' });
    } finally {
      console.error = originalError;
    }

    const events = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    expect(events.length === 2, `the hook should fire once per call, fired ${events.length} times`);
    expect(events[0].notification.id === result.notification.id && events[0].notification.title === 'Hooked' && events[0].refreshed === false, 'the first payload carries the notification');
    expect(events[0].recipientIds.length === 2 && events[0].recipientIds.includes(state.ids.alice), 'and the recipients');
    expect(events[1].refreshed === true && events[1].recipientIds.length === 1, 'a refresh says so');
    pass();
  },

  'no hook fires when nobody was reached': async ({ pass }) => {
    const log = path.join(state.tmp, 'hook.log');
    const before = (await readFile(log, 'utf8')).trim().split('\n').length;
    await createNotification({ owner: OWNER, title: 'Nobody', userIds: [] });
    expect((await readFile(log, 'utf8')).trim().split('\n').length === before, 'an empty send fires nothing');
    await db.delete(hook).where(eq(hook.owner, OWNER));
    pass();
  },

  'title and message are stored exactly as given, never interpreted': async ({ pass }) => {
    const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    await send({ title: payload, message: payload, userIds: [state.ids.alice], dedupeKey: 'xss' });
    const item = (await listFor(state.ids.alice)).notifications.find(n => n.title === payload);
    expect(item && item.message === payload, 'the text is kept verbatim so the UI can render it as text, which is what makes it safe');
    pass();
  },
});

export const afterAll = async () => {
  if(databaseReachable) await purge();
  await rm(state.tmp, { recursive: true, force: true }).catch(() => {});
};

export default databaseReachable
  ? buildTests()
  : { 'notifications (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
