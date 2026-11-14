import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, and } from 'drizzle-orm';
import { reachable, seedDatabase } from './helpers/db.js';

/*
  The system:Guests group holds the permissions every guest has. It is seeded for a new site and added on startup for an old one,
  starts with no permissions, cannot be deleted, and logged-in people cannot be members of it.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { group, groupPermission, permission, user, userGroup, guestSession } = await load('server/db/schema.js');
const { createUser, deleteUser, addUserToGroup, getGuestPermissions, guestHasPermission, getUserGroups, getUserPermissions, createGuest, restrictGuest, isGuestRestricted, pruneGuests, markUserRestricted, removeUserFromGroup } = await load('server/sdk.js');
const checkPageAccess = (await load('server/utils/pages/checkPageAccess.js')).default;
const { ensureSystemGroups, GUESTS_GROUP, RESTRICTED_GROUP } = await load('server/utils/setup/systemGroups.js');
const addPermissionToGroup = (await load('server/utils/permissions/addPermissionToGroup.js')).default;
const removePermissionFromGroup = (await load('server/utils/permissions/removePermissionFromGroup.js')).default;

const databaseReachable = await reachable(db);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const PERMISSION = 'guest-group-test:thing:use';
const EMAIL = 'guest-group-user@test.local';
const OTHER = 'guest-group-test:other:use';

const cleanup = async () => {
  for(const name of [PERMISSION, OTHER]){
    await db.delete(groupPermission).where(eq(groupPermission.permissionName, name)).catch(() => {});
    await db.delete(permission).where(eq(permission.name, name)).catch(() => {});
  }
  await db.delete(guestSession).where(eq(guestSession.createdAt, new Date(0))).catch(() => {});
  await db.delete(user).where(eq(user.email, EMAIL)).catch(() => {});
};

const addPermission = name => db.insert(permission).values({ name, description: 'test', owner: 'guest-group-test', createdAt: new Date() });

const access = (meta, guestRestricted = false) => checkPageAccess({ meta, guestRestricted }).then(([error, result]) => { if(error) throw new Error(error.msg); return result; });

const buildTests = () => ({
  'seeding creates the guests group with no permissions': async ({ pass }) => {
    await seedDatabase();
    const [row] = await db.select().from(group).where(eq(group.name, GUESTS_GROUP));
    expect(row && row.owner === 'system', 'the group exists and is a system group');
    const rows = await db.select().from(groupPermission).where(eq(groupPermission.groupName, GUESTS_GROUP));
    expect(rows.length === 0, 'and holds no permissions');
    pass();
  },

  'an older site gets the group on startup, and a second run changes nothing': async ({ pass }) => {
    await db.delete(group).where(eq(group.name, GUESTS_GROUP)).catch(async () => {
      await db.update(group).set({ owner: 'user' }).where(eq(group.name, GUESTS_GROUP));
      await db.delete(group).where(eq(group.name, GUESTS_GROUP));
    });
    expect((await db.select().from(group).where(eq(group.name, GUESTS_GROUP))).length === 0, 'it is gone');

    const [error, first] = await ensureSystemGroups();
    expect(!error && first.added.includes(GUESTS_GROUP), 'the first run adds it');
    const [, second] = await ensureSystemGroups();
    expect(second.added.length === 0, 'the second adds nothing');
    const [row] = await db.select().from(group).where(eq(group.name, GUESTS_GROUP));
    expect(row.owner === 'system', 'as a system group');
    pass();
  },

  'a guest holds the permissions of the group, and nothing else': async ({ pass }) => {
    await seedDatabase();
    await cleanup();
    await db.insert(permission).values({ name: PERMISSION, description: 'test', owner: 'guest-group-test', createdAt: new Date() });

    const [, none] = await getGuestPermissions();
    expect(!none.includes(PERMISSION), 'not held before it is granted');
    expect((await guestHasPermission(PERMISSION))[1] === false, 'guestHasPermission is false');

    const [grantError] = await addPermissionToGroup(GUESTS_GROUP, PERMISSION);
    expect(!grantError, 'the permission can be granted to the group');
    const [, held] = await getGuestPermissions();
    expect(held.includes(PERMISSION), 'held once granted');
    expect((await guestHasPermission(PERMISSION))[1] === true, 'guestHasPermission is true');

    const [, others] = await guestHasPermission('system:admin:access');
    expect(others === false, 'an unrelated permission is not held');
    expect((await guestHasPermission(''))[0]?.code === 400, 'a name is required');

    await removePermissionFromGroup(GUESTS_GROUP, PERMISSION);
    expect((await guestHasPermission(PERMISSION))[1] === false, 'and gone once taken away');
    pass();
  },

  'a logged-in person gets nothing from the guests group and cannot join it': async ({ pass }) => {
    await seedDatabase();
    await cleanup();
    await db.insert(permission).values({ name: PERMISSION, description: 'test', owner: 'guest-group-test', createdAt: new Date() });
    await addPermissionToGroup(GUESTS_GROUP, PERMISSION);

    const [createError, created] = await createUser({ email: EMAIL, password: 'GuestGroup123!', name: 'Guest Group' });
    expect(!createError, `the user is created: ${createError?.msg}`);
    const userId = created.user?.id ?? created.id;

    const [joinError] = await addUserToGroup(userId, GUESTS_GROUP);
    expect(joinError?.code === 400, 'adding a user to the guests group is refused');
    expect(!(await db.select().from(userGroup).where(and(eq(userGroup.userId, userId), eq(userGroup.groupName, GUESTS_GROUP)))).length, 'and nothing is stored');

    const [, groups] = await getUserGroups(userId);
    expect(!groups.some(g => g.name === GUESTS_GROUP), 'the user is not in it');
    const [, permissions] = await getUserPermissions(userId);
    expect(!permissions.includes(PERMISSION), 'and does not get its permissions');

    await deleteUser(userId);
    await cleanup();
    pass();
  },

  'a page that requires permissions is open to a guest who has them, and a page that requires login is not': async ({ pass }) => {
    await seedDatabase();
    await cleanup();
    await addPermission(PERMISSION);

    const page = { 'require-permissions': PERMISSION };
    const denied = await access(page);
    expect(!denied.allowed && denied.reason === 'login', 'a guest without the permission is sent to log in');

    await addPermissionToGroup(GUESTS_GROUP, PERMISSION);
    expect((await access(page)).allowed, 'a guest with it gets in');
    expect((await access({ 'require-permissions': `${PERMISSION} && ${OTHER}` })).allowed === false, 'the whole expression must hold');

    const login = await access({ 'require-login': 'true', 'require-permissions': PERMISSION });
    expect(!login.allowed && login.reason === 'login', 'require-login keeps a guest out whatever the group holds');
    expect(!(await access({ 'require-login': 'true' })).allowed, 'and on its own');
    expect((await access({})).allowed, 'a page with no restriction is open');
    pass();
  },

  'a restricted guest has no permissions at all': async ({ pass }) => {
    await seedDatabase();
    await cleanup();
    await addPermission(PERMISSION);
    await addPermission(OTHER);
    await addPermissionToGroup(GUESTS_GROUP, PERMISSION);
    await addPermissionToGroup(GUESTS_GROUP, OTHER);

    expect((await guestHasPermission(PERMISSION))[1] === true, 'an unrestricted guest has it');
    expect((await guestHasPermission(PERMISSION, { restricted: true }))[1] === false, 'a restricted guest does not');
    expect((await guestHasPermission(OTHER, { restricted: true }))[1] === false, 'nor any other');
    expect((await getGuestPermissions({ restricted: true }))[1].length === 0, 'it holds none');
    expect(!(await access({ 'require-permissions': PERMISSION }, true)).allowed, 'so a page that needs one is closed to them');
    expect((await access({ 'require-permissions': PERMISSION }, false)).allowed, 'and open to a guest who is not restricted');
    pass();
  },

  'a user in the restricted group loses what it holds, however they got it': async ({ pass }) => {
    await seedDatabase();
    await cleanup();
    await addPermission(PERMISSION);
    await addPermissionToGroup('system:Users', PERMISSION);

    const [, created] = await createUser({ email: EMAIL, password: 'GuestGroup123!', name: 'Guest Group' });
    const userId = created.user?.id ?? created.id;
    expect((await getUserPermissions(userId))[1].includes(PERMISSION), 'the user has it');

    await addPermissionToGroup(RESTRICTED_GROUP, PERMISSION);
    expect((await addUserToGroup(userId, RESTRICTED_GROUP))[0] === null, 'the user can be restricted');
    expect(!(await getUserPermissions(userId))[1].includes(PERMISSION), 'and no longer has it');

    await removePermissionFromGroup('system:Users', PERMISSION);
    await deleteUser(userId);
    await cleanup();
    pass();
  },

  'restricting a guest is recorded, can be lifted, and keeps it from being pruned': async ({ pass }) => {
    const [, guest] = await createGuest();
    expect((await isGuestRestricted({ token: guest.token }))[1] === false, 'not restricted at first');
    expect((await restrictGuest({ token: guest.token }))[0] === null, 'restricted');
    expect((await isGuestRestricted({ token: guest.token }))[1] === true, 'and recorded');

    await db.update(guestSession).set({ lastSeenAt: new Date(Date.now() - 400 * 86400000) }).where(eq(guestSession.token, guest.token));
    await pruneGuests({ days: 60 });
    expect((await db.select().from(guestSession).where(eq(guestSession.token, guest.token))).length === 1, 'a restricted guest is not pruned for being idle');

    await restrictGuest({ token: guest.token, restricted: false });
    expect((await isGuestRestricted({ token: guest.token }))[1] === false, 'lifted');
    await pruneGuests({ days: 60 });
    expect((await db.select().from(guestSession).where(eq(guestSession.token, guest.token))).length === 0, 'and pruned like any other once it is');

    expect((await restrictGuest({ token: 'nope' }))[0]?.code === 404, 'an unknown guest is a 404');
    expect((await isGuestRestricted({ token: 'nope' }))[1] === false, 'and is not restricted');
    pass();
  },

  'a restricted user is marked with a record that follows them, and it is lifted when they leave the group': async ({ pass }) => {
    await seedDatabase();
    await cleanup();
    const [, created] = await createUser({ email: EMAIL, password: 'GuestGroup123!', name: 'Guest Group' });
    const userId = created.user?.id ?? created.id;

    expect((await markUserRestricted({ userId }))[1] === null, 'a user who is not restricted has no marker');

    await addUserToGroup(userId, RESTRICTED_GROUP);
    const [, token] = await markUserRestricted({ userId });
    expect(token && (await isGuestRestricted({ token }))[1] === true, 'a restricted user gets a restricted record');
    expect((await markUserRestricted({ userId }))[1] === token, 'the same record is used again, not a new one each time');
    expect((await db.select().from(guestSession).where(eq(guestSession.mergedIntoUserId, userId))).length === 1, 'so cookies cleared over and over leave one');

    await removeUserFromGroup(userId, RESTRICTED_GROUP);
    expect((await isGuestRestricted({ token }))[1] === false, 'leaving the group lifts it');
    expect((await markUserRestricted({ userId }))[1] === null, 'and they are not marked again');

    await deleteUser(userId);
    await db.delete(guestSession).where(eq(guestSession.token, token)).catch(() => {});
    await cleanup();
    pass();
  },

  'the guests group cannot be deleted': async ({ pass }) => {
    await seedDatabase();
    let refused = false;
    await db.delete(group).where(eq(group.name, GUESTS_GROUP)).catch(() => { refused = true; });
    expect(refused || (await db.select().from(group).where(eq(group.name, GUESTS_GROUP))).length === 1, 'the group is still there');
    pass();
  },
});

export const afterAll = async () => {
  if(databaseReachable) await cleanup();
};

export default databaseReachable
  ? buildTests()
  : { 'guest group (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
