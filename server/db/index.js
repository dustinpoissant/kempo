import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { existsSync, realpathSync } from 'fs';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import 'dotenv/config';
import * as frameworkSchema from './schema.js';

/*
  Load app schema if it exists at <project root>/server/db/schema.js
*/

let appSchema = {};
const appSchemaPath = join(process.cwd(), 'server', 'db', 'schema.js');
const frameworkSchemaPath = fileURLToPath(new URL('./schema.js', import.meta.url));

if(existsSync(appSchemaPath) && realpathSync(appSchemaPath) !== realpathSync(frameworkSchemaPath)){
  appSchema = await import(pathToFileURL(appSchemaPath).href);
}

const schema = { ...frameworkSchema, ...appSchema };

let db;

/*
  KEMPO_DB=pglite swaps the server for an in-process, in-memory Postgres (PGlite) with the schema
  applied, so the unit tier needs no service and cannot skip for want of one. It is real Postgres
  (jsonb, partial indexes, ON CONFLICT, triggers), not a mock. Nothing outside tests sets it, and
  PGlite is a dev dependency that is only imported on this branch.
*/
if(process.env.KEMPO_DB === 'pglite'){
  const [{ PGlite }, { drizzle: drizzlePglite }, { generateDrizzleJson, generateMigration }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-kit/api')
  ]);
  /*
    A project's drizzle.config.js lists every schema its database holds (its own, kempo's and any
    extensions it sits on), because `drizzle-kit push` needs the same list. Use it, so the in-memory
    database is exactly what a push would have made.
  */
  const configPath = join(process.cwd(), 'drizzle.config.js');
  if(existsSync(configPath)){
    const { default: config } = await import(pathToFileURL(configPath).href);
    for(const entry of [config?.schema].flat().filter(Boolean)){
      const file = join(process.cwd(), entry);
      if(existsSync(file)) Object.assign(schema, await import(pathToFileURL(realpathSync(file)).href));
    }
  }

  const client = new PGlite();
  db = drizzlePglite(client, { schema });

  /*
    The database is empty, so the whole schema is the diff from nothing. This is drizzle-kit's own
    generator, so indexes, unique constraints and foreign keys match `drizzle-kit push` exactly.
  */
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
  await client.exec(statements.join('\n'));

  /*
    postgres-js answers db.execute() with an array of rows and PGlite with `{ rows }`. Make PGlite look
    like postgres-js (keeping `.rows`) so code and tests that read a raw result work on either.
  */
  const execute = db.execute.bind(db);
  db.execute = async query => {
    const result = await execute(query);
    return Object.assign([...result.rows], { rows: result.rows });
  };
} else {
  db = drizzle(postgres(process.env.DATABASE_URL), { schema });
}

export default db;
