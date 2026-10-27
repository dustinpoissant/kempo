import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq, sql, and, ne, or, ilike } from 'drizzle-orm';

export default async ({ q = '', limit = 50, offset = 0, owner } = {}) => {
  try {
    const conditions = [];
    if(owner === 'extension'){
      conditions.push(and(ne(group.owner, 'system'), ne(group.owner, 'custom')));
    } else if(owner !== undefined){
      conditions.push(eq(group.owner, owner));
    }
    if(q){
      conditions.push(or(ilike(group.name, `%${q}%`), ilike(group.description, `%${q}%`)));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const baseQuery = db.select().from(group);
    const countQuery = db.select({ count: sql`count(*)` }).from(group);
    const groups = await (where ? baseQuery.where(where) : baseQuery).limit(limit).offset(offset);
    const [{ count }] = await (where ? countQuery.where(where) : countQuery);
    return [null, { groups, total: Number(count), limit, offset }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve groups' }, null];
  }
};
