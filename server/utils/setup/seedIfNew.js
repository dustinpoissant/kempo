import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import seedDatabase from './seedDatabase.js';

/*
  A database with no Administrators group is a new one (the group cannot be deleted), so kempo's groups, permissions and
  settings are put in it, which is what `scripts/init-db.js` does by hand. It is what lets a new site start from an empty
  database with no command typed: the tables come from syncCoreSchema, this fills them, and the /setup page makes the
  first administrator. A database that has the group is never touched.
*/
export default async () => {
  try {
    const [existing] = await db.select({ name: group.name }).from(group).where(eq(group.name, 'system:Administrators')).limit(1);
    if(existing) return [null, { seeded: false }];
    await seedDatabase({ log: () => {} });
    return [null, { seeded: true }];
  } catch(error) {
    return [{ code: 500, msg: `A new database could not be set up: ${String(error.cause?.message || error.message).slice(0, 300)}` }, null];
  }
};
