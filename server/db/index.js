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

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema: { ...frameworkSchema, ...appSchema } });

export default db;
