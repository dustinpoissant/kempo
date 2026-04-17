import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq, sql, and, ne } from 'drizzle-orm';

export default async ({ limit = 50, offset = 0, owner } = {}) => {
  try {
    let where;
    if(owner === 'extension'){
      where = and(ne(group.owner, 'system'), ne(group.owner, 'custom'));
    } else if(owner !== undefined){
      where = eq(group.owner, owner);
    }
    const baseQuery = db.select().from(group);
    const countQuery = db.select({ count: sql`count(*)` }).from(group);
    const groups = await (where ? baseQuery.where(where) : baseQuery).limit(limit).offset(offset);
    const [{ count }] = await (where ? countQuery.where(where) : countQuery);
    return [null, { groups, total: Number(count), limit, offset }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve groups' }, null];
  }
};
