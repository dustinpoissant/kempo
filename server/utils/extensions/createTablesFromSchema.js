import { getTableConfig } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import db from '../../db/index.js';

/*
  A column's SQL type is whatever Drizzle says it is (`bigserial`, `varchar(255)`, `timestamp`, `text[]`), never a
  guess. A hand-kept map of types once sent `bigserial` to `text` with no sequence, which made a table that could
  not take an insert. An enum has a type of its own that does not exist here yet, so it is stored as text.
*/
const sqlTypeOf = column => {
  if(column.columnType === 'PgEnumColumn') return 'text';
  try {
    return column.getSQLType();
  } catch {
    return 'text';
  }
};

const serializeDefault = (value) => {
  if(typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if(typeof value === 'boolean' || typeof value === 'number') return String(value);
  if(value === null) return 'null';
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
};

const tableToSql = (table) => {
  const config = getTableConfig(table);
  const primaryKeys = config.columns.filter(c => c.primary).map(c => c.name);
  const cols = config.columns.map(c => {
    let def = `"${c.name}" ${sqlTypeOf(c)}`;
    if(c.notNull) def += ' NOT NULL';
    if(c.hasDefault && c.default !== undefined) def += ` DEFAULT ${serializeDefault(c.default)}`;
    if(c.primary && primaryKeys.length === 1) def += ' PRIMARY KEY';
    return def;
  });
  if(primaryKeys.length > 1) cols.push(`PRIMARY KEY (${primaryKeys.map(k => `"${k}"`).join(', ')})`);
  return `CREATE TABLE IF NOT EXISTS "${config.name}" (${cols.join(', ')})`;
};

export default async (schemaModule) => {
  for(const exported of Object.values(schemaModule)){
    if(typeof exported !== 'object' || !exported?.[Symbol.for('drizzle:Name')]) continue;
    try {
      await db.execute(sql.raw(tableToSql(exported)));
    } catch(error){
      return [{ code: 500, msg: `Failed to create table: ${error.message}` }, null];
    }
  }
  return [null, true];
};
