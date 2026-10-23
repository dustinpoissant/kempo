import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, sql } from 'drizzle-orm';
import { pgTable, text, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { reachable, seedDatabase } from './helpers/db.js';

/*
  Keeping kempo's own tables in step with the installed version when the server starts, so updating from the admin
  never needs a command typed: what is added, what is never touched (the tables of the site and of extensions, columns
  kempo no longer has, anything that could lose data), and how a problem reaches the administrators.

  The suites that break things do it to the shared test database: a scratch table, and a few of kempo's own pieces that the
  sync is then expected to put back (and is made to, even when a check fails, so the other suites are not left without them).
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const coreSchema = await load('server/db/schema.js');
const { user, userGroup, session, notification } = coreSchema;
const { createUser, addUserToGroup } = await load('server/sdk.js');
const syncCoreSchema = (await load('server/utils/setup/syncCoreSchema.js')).default;
const { isAdditive, describe } = await load('server/utils/setup/syncCoreSchema.js');
const notifySchemaAttention = (await load('server/utils/updates/notifySchemaAttention.js')).default;
const getUpdateStatus = (await load('server/utils/updates/getUpdateStatus.js')).default;

const databaseReachable = await reachable(db);

/* An update time that is recent, so the hourly cleanup of old notifications does not delete the row it is set on. */
const MARKER = new Date(Date.now() - 60000);

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const ADMIN_EMAIL = 'schema-sync-test-admin@test.local';

const rows = async query => {
  const result = await db.execute(query);
  return Array.isArray(result) ? result : result.rows;
};

const run = async statements => {
  for(const statement of statements) await db.execute(sql.raw(statement));
};

const columnType = async (table, name) => (await rows(sql`select data_type from information_schema.columns where table_schema = 'public' and table_name = ${table} and column_name = ${name}`))[0]?.data_type;

const tableExists = async table => (await rows(sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = ${table}`)).length === 1;

const count = async table => (await rows(sql.raw(`select count(*)::int as n from ${table}`)))[0].n;

const purge = async () => {
  await db.delete(notification).where(eq(notification.owner, 'kempo')).catch(() => {});
  const [row] = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL));
  if(row){
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
};

const buildTests = () => ({
  'only additions are ever run': async ({ pass }) => {
    const additions = [
      'CREATE TABLE "a" ("id" text)',
      'CREATE INDEX "i" ON "a" USING btree ("id");',
      'CREATE UNIQUE INDEX "u" ON "a" ("id");',
      'ALTER TABLE "a" ADD COLUMN "b" text;',
      'ALTER TABLE "a" ADD CONSTRAINT "c" FOREIGN KEY ("b") REFERENCES "a"("id");',
      'CREATE TYPE "t" AS ENUM (\'x\');',
    ];
    const others = [
      'DROP TABLE "a";',
      'DROP INDEX "i";',
      'ALTER TABLE "a" DROP COLUMN "b";',
      'ALTER TABLE "a" DROP CONSTRAINT "c";',
      'ALTER TABLE "a" ALTER COLUMN "b" SET DATA TYPE integer;',
      'ALTER TABLE "a" ALTER COLUMN "b" SET NOT NULL;',
      'ALTER TABLE "a" RENAME COLUMN "b" TO "c";',
      'TRUNCATE "a";',
      'truncate table "a" cascade;',
      'UPDATE "a" SET "b" = 1;',
      'DELETE FROM "a";',
    ];
    for(const statement of additions) expect(isAdditive(statement), `should be run: ${statement}`);
    for(const statement of others) expect(!isAdditive(statement), `must never be run: ${statement}`);
    expect(describe('CREATE TABLE "notification" (...)') === 'Created table notification', 'a new table reads as a sentence');
    expect(describe('ALTER TABLE "dashboardWidget" ADD COLUMN "iconSrc" text;') === 'Added column dashboardWidget.iconSrc', 'a new column reads as a sentence');
    pass();
  },

  'an older database gets what kempo gained, and nothing of the site or an extension is touched': async ({ pass }) => {
    try {
      await run([
        'ALTER TABLE "dashboardWidget" DROP COLUMN "iconSrc"',
        'DROP TABLE "notificationRecipient"',
        'DROP TABLE "notification"',
        'CREATE TABLE ext_table (id text primary key, owner text)',
        "INSERT INTO ext_table VALUES ('1', 'x')",
        'ALTER TABLE "extension" ADD COLUMN mine text',
      ]);

      const [error, result] = await syncCoreSchema();
      expect(!error, `the sync failed: ${JSON.stringify(error)}`);
      for(const wanted of ['Created table notification', 'Created table notificationRecipient', 'Added column dashboardWidget.iconSrc']){
        expect(result.applied.includes(wanted), `missing "${wanted}" in ${JSON.stringify(result.applied)}`);
      }
      expect(result.applied.some(line => /^Created index notification_updatedAt_idx/.test(line)), 'a new table comes with its indexes');
      expect(result.applied.some(line => /notificationRecipient_notificationId_notification_id_fk/.test(line)), 'and its foreign keys');
      expect(await tableExists('notification') && await columnType('dashboardWidget', 'iconSrc'), 'the table and the column exist now');
      expect(await count('ext_table') === 1, "another table's rows are untouched");
      expect(await columnType('extension', 'mine'), 'a column kempo does not know about is not dropped');
      expect(result.failed.length === 0, `nothing failed: ${JSON.stringify(result.failed)}`);

      const [, again] = await syncCoreSchema();
      expect(again.applied.length === 0 && again.failed.length === 0, 'a second run finds nothing to do');
    } finally {
      await run(['DROP TABLE IF EXISTS ext_table', 'ALTER TABLE "extension" DROP COLUMN IF EXISTS mine']);
      await syncCoreSchema();
    }
    pass();
  },

  'a change the database refuses is reported, what exists is never altered and the rest is applied': async ({ pass }) => {
    const syncthing = pgTable('syncthing', { id: text('id').primaryKey(), tag: text('tag'), kind: integer('kind'), extra: integer('extra') }, table => [uniqueIndex('syncthing_tag_idx').on(table.tag)]);
    try {
      await run(['DROP TABLE IF EXISTS syncthing', 'CREATE TABLE syncthing (id text PRIMARY KEY, tag text, kind text)', "INSERT INTO syncthing VALUES ('1', 'same', 'a'), ('2', 'same', 'b')"]);

      const [error, result] = await syncCoreSchema({ schema: { syncthing } });
      expect(!error, `the sync failed outright: ${JSON.stringify(error)}`);
      expect(result.applied.includes('Added column syncthing.extra'), `the new column is added: ${JSON.stringify(result)}`);
      expect(result.failed.length === 1 && /syncthing_tag_idx/.test(result.failed[0].change) && result.failed[0].reason, "the unique index over duplicate rows is reported with the database's reason");
      expect(await columnType('syncthing', 'kind') === 'text', 'a column whose type differs from the schema is left as it is');
      expect(await count('syncthing') === 2, 'no rows were lost');
    } finally {
      await run(['DROP TABLE IF EXISTS syncthing']);
    }
    pass();
  },

  'a problem is raised to the administrators once, and a clean sync says nothing': async ({ pass }) => {
    await purge();
    await seedDatabase();
    const [, created] = await createUser({ name: 'schema sync', email: ADMIN_EMAIL, password: 'SchemaSync123!', emailVerified: true });
    await addUserToGroup(created.user.id, 'system:Administrators');
    const notices = async () => (await db.select().from(notification).where(eq(notification.owner, 'kempo'))).filter(row => row.dedupeKey?.startsWith('schema:'));

    await notifySchemaAttention({ result: { applied: ['Created table x'], failed: [] } });
    expect((await notices()).length === 0, 'applied changes are not a problem');

    const result = { applied: [], failed: [{ change: 'Created index i', reason: 'duplicate key' }] };
    await notifySchemaAttention({ result });
    const [notice] = await notices();
    expect(notice && notice.level === 'error' && notice.message.includes('duplicate key') && notice.actions[0].href === '/admin/updates', 'a failed change raises an error that links to the Updates screen');

    await db.update(notification).set({ updatedAt: MARKER }).where(eq(notification.id, notice.id));
    await notifySchemaAttention({ result });
    const after = await notices();
    expect(after.length === 1 && after[0].updatedAt.getTime() === MARKER.getTime(), 'the same problem is not raised again at the next start');
    pass();
  },

  'the update status carries what the last sync did': async ({ pass }) => {
    const [, status] = await getUpdateStatus({ offline: true, install: { canUpdate: true, reason: null } });
    expect(status.database && Array.isArray(status.database.applied) && Array.isArray(status.database.failed), 'the Updates screen gets what was applied and what failed');
    pass();
  },
});

export const afterAll = async () => {
  if(databaseReachable) await purge();
};

export default databaseReachable
  ? buildTests()
  : { 'schema sync (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
