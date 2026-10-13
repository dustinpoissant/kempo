import { sql } from 'drizzle-orm';

/*
  Shared by the database-backed suites. See scripts/run-tests.js for the tiers.
*/

export const unitTier = process.env.KEMPO_DB === 'pglite';
export const integrationTier = process.env.KEMPO_TEST_TIER === 'integration';

/*
  True when the database answers. In the integration tier an unreachable database is an error, not a
  skip: that tier exists to run these suites, so passing without them would be a false green.
*/
export const reachable = async db => {
  const ok = await db.execute(sql`select 1`).then(() => true).catch(() => false);

  if(!ok && integrationTier){
    throw new Error('The integration tier needs a reachable Postgres: set DATABASE_URL and apply the schema (npx drizzle-kit push).');
  }

  return ok;
};

/*
  Seeds the system groups, permissions and settings in-process, so it lands in the same database the
  suite is using (a child process cannot reach an in-memory one).
*/
export const seedDatabase = async () => (await import('../../server/utils/setup/seedDatabase.js')).default({ log: () => {} });

/*
  The suite for a file that belongs to the integration tier, reported as such in the unit tier. It is
  explicit rather than a silent skip, and `npm run test:integration` is where it runs.
*/
export const integrationOnly = name => ({
  [`${name} (integration tier)`]: async ({ pass }) => pass('runs in `npm run test:integration`: it needs a real Postgres or a second server process'),
});
