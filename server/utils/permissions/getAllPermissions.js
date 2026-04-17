import db from '../../db/index.js';
import { permission } from '../../db/schema.js';
import { eq, sql, and, ne } from 'drizzle-orm';

export default async ({ limit = 50, offset = 0, owner } = {}) => {
  try {
    let where;
    if(owner === 'extension'){
      where = and(ne(permission.owner, 'system'), ne(permission.owner, 'custom'));
    } else if(owner !== undefined){
      where = eq(permission.owner, owner);
    }
    const baseQuery = db.select().from(permission);
    const countQuery = db.select({ count: sql`count(*)` }).from(permission);
    const permissions = await (where ? baseQuery.where(where) : baseQuery).limit(limit).offset(offset);
    const [{ count }] = await (where ? countQuery.where(where) : countQuery);
    return [null, { permissions, total: Number(count), limit, offset }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve permissions' }, null];
  }
};
