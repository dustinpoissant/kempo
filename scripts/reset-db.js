import readline from 'readline';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import db from '../server/db/index.js';
import { sql } from 'drizzle-orm';

/*
  Deletes every table and all of their data, then creates the tables again and seeds the defaults. Run it through
  `npx kempo reset-db` (or `npm run db:reset` in kempo itself) from the site's folder, so the site's .env and
  drizzle.config.js are the ones used.
*/
const cli = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
const initDb = fileURLToPath(new URL('./init-db.js', import.meta.url));

const run = (args, options = {}) => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', ...options });
  if(result.status !== 0){
    console.error(`\n❌ ${args.join(' ')} failed`);
    process.exit(result.status ?? 1);
  }
};

if(!process.argv.includes('-y') && !process.argv.includes('--yes')){
  const answer = await new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('This deletes every table and all of their data. Type RESET to continue: ', answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
  if(answer !== 'RESET'){
    console.log('Cancelled. Nothing was changed.');
    process.exit(0);
  }
}

if(existsSync(join(process.cwd(), 'docker-compose.yml'))){
  console.log('Step 1: Ensuring Docker containers are up...');
  const up = spawnSync('docker', ['compose', 'up', '-d', 'postgres'], { stdio: 'inherit', shell: true });
  if(up.status !== 0){
    console.error('\n❌ docker compose up failed. Is Docker Desktop running?');
    process.exit(up.status ?? 1);
  }
}

console.log('\nStep 2: Dropping all tables...');
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

console.log('\nStep 3: Recreating tables...');
run([cli, 'db', 'push', '--force']);

console.log('\nStep 4: Initializing database with default data...');
run([initDb]);

console.log('\n✅ Database reset complete!');
process.exit(0);
