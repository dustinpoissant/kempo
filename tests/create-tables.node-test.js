import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql } from 'drizzle-orm';
import { pgTable, text, boolean, integer, bigint, bigserial, serial, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { reachable } from './helpers/db.js';

/*
  The installer makes an extension's tables from its Drizzle schema. A column must come out as what the
  schema says, in particular an auto-incrementing id must still count up: that went wrong once (a
  `bigserial` became plain text with no sequence, and every insert without an id failed).
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const createTablesFromSchema = (await load('server/utils/extensions/createTablesFromSchema.js')).default;

const databaseReachable = await reachable(db);

const generated = pgTable('kempoTestGenerated', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  small: serial('small').notNull(),
  label: varchar('label', { length: 12 }).notNull(),
  note: text('note'),
  count: integer('count').notNull().default(0),
  big: bigint('big', { mode: 'number' }),
  on: boolean('on').notNull().default(true),
  at: timestamp('at').notNull(),
  data: jsonb('data'),
});

const typeOf = async column => {
  const rows = await db.execute(sql`select format_type(a.atttypid, a.atttypmod) as type, c.column_default as "default"
    from information_schema.columns c join pg_attribute a on a.attrelid = '"kempoTestGenerated"'::regclass and a.attname = c.column_name
    where c.table_name = 'kempoTestGenerated' and c.column_name = ${column}`);
  return rows[0];
};

export const afterAll = async () => {
  await db.execute(sql`drop table if exists "kempoTestGenerated"`);
};

export default databaseReachable ? {
  'a column comes out as the type its schema declares': async ({ pass, fail }) => {
    await db.execute(sql`drop table if exists "kempoTestGenerated"`);
    const [error] = await createTablesFromSchema({ generated });
    if(error) return fail(error.msg);

    const expected = { id: 'bigint', small: 'integer', label: 'character varying(12)', note: 'text', count: 'integer', big: 'bigint', on: 'boolean', at: 'timestamp without time zone', data: 'jsonb' };
    for(const [column, type] of Object.entries(expected)){
      const found = await typeOf(column);
      if(found?.type !== type) return fail(`${column} is ${found?.type}, expected ${type}`);
    }
    pass('');
  },

  'an auto-incrementing id still counts up on insert': async ({ pass, fail }) => {
    for(const column of ['id', 'small']){
      const found = await typeOf(column);
      if(!/nextval/.test(found?.default ?? '')) return fail(`${column} has no sequence (default ${found?.default})`);
    }
    await db.execute(sql`insert into "kempoTestGenerated" ("label", "at") values ('one', now()), ('two', now())`);
    const rows = await db.execute(sql`select "id", "small", "count", "on" from public."kempoTestGenerated" order by "id"`);
    if(rows.length !== 2 || Number(rows[0].id) !== 1 || Number(rows[1].id) !== 2 || Number(rows[1].small) !== 2) return fail(`ids ${JSON.stringify(rows)}`);
    if(Number(rows[0].count) !== 0 || rows[0].on !== true) return fail('column defaults were not applied');
    pass('');
  },

  'running it again leaves an existing table alone': async ({ pass, fail }) => {
    const [error] = await createTablesFromSchema({ generated });
    if(error) return fail(error.msg);
    const rows = await db.execute(sql`select count(*)::int as total from public."kempoTestGenerated"`);
    if(rows[0].total !== 2) return fail('the rows were lost');
    pass('');
  },
} : {
  'the table generator needs a database': async ({ pass }) => pass('skipped: no database'),
};
