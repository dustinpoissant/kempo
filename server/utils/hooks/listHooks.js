import db from '../../db/index.js';
import { hook } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export default async ({ event, owner, limit = 50, offset = 0 } = {}) => {
  try {
    const conditions = [];
    if(event) conditions.push(eq(hook.event, event));
    if(owner) conditions.push(eq(hook.owner, owner));

    const query = db.select().from(hook);
    const countQuery = db.select({ count: sql`count(*)` }).from(hook);

    if(conditions.length){
      const { and } = await import('drizzle-orm');
      const where = conditions.length === 1 ? conditions[0] : and(...conditions);
      query.where(where);
      countQuery.where(where);
    }

    const [items, [{ count }]] = await Promise.all([
      query.limit(limit).offset(offset),
      countQuery,
    ]);

    return [null, { items, total: Number(count), limit, offset }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to list hooks' }, null];
  }
};
