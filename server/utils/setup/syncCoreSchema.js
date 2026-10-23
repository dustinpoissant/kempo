import { sql } from 'drizzle-orm';
import db from '../../db/index.js';
import * as coreSchema from '../../db/schema.js';

/*
  Brings kempo's own tables in step with the installed version of kempo, so an update never needs a command typed.
  It runs when the server starts, before the site serves anything.

  It only ever adds. It looks at which of the schema's tables, columns, indexes and constraints the database already
  has, and asks drizzle-kit's migration generator (the one `drizzle-kit push` is built on) for the difference between
  "what the database has" and "what the schema says", so the new indexes and foreign keys come out exactly as a push
  would make them. What the database has is the schema with every missing piece cut out, so the difference can only
  be additions: it can never contain a DROP or a TRUNCATE, and a table that an extension or the site made is never
  looked at. A column that kempo no longer has stays where it is. A change to something that already exists (a new
  type, a NOT NULL) is not detected here: that is what a release's own migration step is for.

  Each statement is applied on its own, so one the database refuses (a new unique index over rows that already break
  it, a NOT NULL column with no default on a table that has rows) is reported without holding back the rest. Several
  processes starting together queue on an advisory lock, and the one after the first finds nothing left to do.

  (drizzle-kit's `pushSchema` is not used: it drops the parameters of its own introspection queries, which fails on any
  table with a composite key and then ends the process, and for a type change it proposes TRUNCATE ... CASCADE.)
*/
const LOCK_KEY = 'kempo:sync-core-schema';

const ADDITIVE = [
  /^CREATE TABLE /i,
  /^CREATE (UNIQUE )?INDEX /i,
  /^CREATE TYPE /i,
  /^ALTER TABLE .+ ADD COLUMN /i,
  /^ALTER TABLE .+ ADD CONSTRAINT /i,
];

/* A last check on what the generator produced: anything that is not an addition is never run. */
export const isAdditive = statement => ADDITIVE.some(pattern => pattern.test(statement.trim()));

/* One plain sentence for a statement, for the log and the Updates screen. */
export const describe = statement => {
  const text = statement.trim();
  const named = (pattern, make) => {
    const match = text.match(pattern);
    return match ? make(...match.slice(1)) : null;
  };
  return named(/^CREATE TABLE "([^"]+)"/i, table => `Created table ${table}`)
    ?? named(/^ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"/i, (table, column) => `Added column ${table}.${column}`)
    ?? named(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"/i, index => `Created index ${index}`)
    ?? named(/^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)"/i, (table, constraint) => `Added ${constraint} to ${table}`)
    ?? text.replace(/\s+/g, ' ').slice(0, 120);
};

const rowsOf = result => (Array.isArray(result) ? result : result.rows);

/* The names of what the database already has in the public schema. */
const readDatabase = async executor => {
  const names = async (query, field) => new Set(rowsOf(await executor.execute(query)).map(row => row[field]));
  const columns = rowsOf(await executor.execute(sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`));
  return {
    tables: await names(sql`select table_name from information_schema.tables where table_schema = 'public'`, 'table_name'),
    columns: new Set(columns.map(row => `${row.table_name}.${row.column_name}`)),
    indexes: await names(sql`select indexname from pg_indexes where schemaname = 'public'`, 'indexname'),
    constraints: await names(sql`select conname from pg_constraint join pg_namespace on pg_namespace.oid = pg_constraint.connamespace where nspname = 'public'`, 'conname'),
    enums: await names(sql`select typname from pg_type join pg_namespace on pg_namespace.oid = pg_type.typnamespace where typtype = 'e' and nspname = 'public'`, 'typname'),
  };
};

/* The schema snapshot with everything the database lacks cut out: what drizzle-kit would see if it had introspected the database. */
const withoutMissing = (snapshot, existing) => {
  const prev = structuredClone(snapshot);
  for(const key of Object.keys(prev.enums)){
    if(!existing.enums.has(prev.enums[key].name)) delete prev.enums[key];
  }
  for(const [key, table] of Object.entries(prev.tables)){
    if(!existing.tables.has(table.name)){
      delete prev.tables[key];
      continue;
    }
    for(const name of Object.keys(table.columns)){
      if(!existing.columns.has(`${table.name}.${name}`)) delete table.columns[name];
    }
    for(const name of Object.keys(table.indexes)){
      if(!existing.indexes.has(name)) delete table.indexes[name];
    }
    for(const group of [table.foreignKeys, table.uniqueConstraints, table.compositePrimaryKeys ?? {}]){
      for(const id of Object.keys(group)){
        if(!existing.constraints.has(group[id].name)) delete group[id];
      }
    }
  }
  return prev;
};

/* What the last run did, for the Updates screen. */
let lastRun = { ran: false, applied: [], failed: [] };

export const getSchemaSyncResult = () => lastRun;

/*
  Resolves to [error, { applied, failed }]: `applied` is a list of sentences, `failed` is { change, reason } for what
  the database refused. `schema` and `executor` are for tests and extensions: other tables, in another database.
*/
export default async ({ schema = coreSchema, executor = db } = {}) => {
  try {
    const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api');
    const wanted = generateDrizzleJson(schema);
    const result = { applied: [], failed: [] };

    await executor.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${LOCK_KEY}::text))`);
      const statements = await generateMigration(withoutMissing(wanted, await readDatabase(tx)), wanted);

      for(const statement of statements){
        if(!isAdditive(statement)){
          result.failed.push({ change: describe(statement), reason: 'Kempo only adds to its tables, so this was not run' });
          continue;
        }
        try {
          await tx.transaction(inner => inner.execute(sql.raw(statement)));
          result.applied.push(describe(statement));
        } catch(error) {
          result.failed.push({ change: describe(statement), reason: String(error.cause?.message || error.message).slice(0, 300) });
        }
      }
    });

    if(schema === coreSchema) lastRun = { ran: true, ...result };
    return [null, result];
  } catch(error) {
    return [{ code: 500, msg: `The database could not be checked against this version of kempo: ${String(error.cause?.message || error.message).slice(0, 300)}` }, null];
  }
};
