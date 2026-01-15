import db from '../server/db/index.js';
import { sql } from 'drizzle-orm';

console.log('Resetting database...');

await db.execute(sql`
  DO $$ 
  DECLARE 
    r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
      EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END $$;
`);

console.log('Database reset complete. All tables dropped.');
console.log('Now run: npm run db:push && node scripts/init-db.js');

process.exit(0);
