import db from '../server/db/index.js';
import { sql } from 'drizzle-orm';
import { spawn } from 'child_process';

const runCommand = (command, args) => new Promise((resolve, reject) => {
  const proc = spawn(command, args, { 
    stdio: 'inherit',
    shell: true
  });
  proc.on('close', code => {
    if(code !== 0){
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      return;
    }
    resolve();
  });
});

console.log('Step 1: Ensuring Docker containers are up...');
await runCommand('docker', ['compose', 'up', '-d', 'postgres']);

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
await runCommand('npm', ['run', 'db:push']);

console.log('\nStep 4: Initializing database with default data...');
await runCommand('node', ['scripts/init-db.js']);

console.log('\n✅ Database reset complete!');

process.exit(0);
