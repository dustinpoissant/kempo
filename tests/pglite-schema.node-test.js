import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  The unit tier's in-memory database is built from the project's own drizzle.config.js schema list, so
  an extension's unit tests see the same tables `drizzle-kit push` would make: its own, kempo's, and the
  extensions it depends on. A child process is used because the database is created once per process
  from the current directory.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'tests', 'fixtures', 'pglite-config');

const tablesFor = cwd => {
  const script = `
    const { default: db } = await import(${JSON.stringify(pathToFileURL(path.join(root, 'server/db/index.js')).href)});
    const { sql } = await import('drizzle-orm');
    const rows = await db.execute(sql\`select table_name from information_schema.tables where table_schema = 'public'\`);
    console.log(JSON.stringify(rows.map(row => row.table_name)));
    process.exit(0);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd, env: { ...process.env, KEMPO_DB: 'pglite' }, encoding: 'utf8' });
  if(result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout.trim().split('\n').pop());
};

export default {
  'the unit-tier database holds the tables from every schema in drizzle.config.js': async ({ pass, fail }) => {
    const tables = tablesFor(fixture);
    for(const expected of ['fixtureOwnTable', 'fixtureDependencyTable', 'user', 'notification', 'dashboardWidget']){
      if(!tables.includes(expected)) return fail(`${expected} is missing; got ${tables.join(', ')}`);
    }
    pass(`${tables.length} tables`);
  },
};
