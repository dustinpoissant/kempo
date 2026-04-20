import db from '../../db/index.js';
import { user, userGroup } from '../../db/schema.js';
import { ilike, or, eq, notInArray, inArray, and, sql } from 'drizzle-orm';

export default async ({ q = '', limit = 20, offset = 0, inGroup, notInGroup } = {}) => {
  try {
    const conditions = [];

    if(q){
      conditions.push(or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`)));
    }

    if(notInGroup){
      const members = await db
        .select({ userId: userGroup.userId })
        .from(userGroup)
        .where(eq(userGroup.groupName, notInGroup));
      const ids = members.map(m => m.userId);
      if(ids.length) conditions.push(notInArray(user.id, ids));
    }

    if(inGroup){
      const members = await db
        .select({ userId: userGroup.userId })
        .from(userGroup)
        .where(eq(userGroup.groupName, inGroup));
      const ids = members.map(m => m.userId);
      conditions.push(ids.length ? inArray(user.id, ids) : sql`false`);
    }

    const where = conditions.length === 1
      ? conditions[0]
      : conditions.length > 1
        ? and(...conditions)
        : undefined;

    const baseQuery = db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
    }).from(user);

    const users = await (where ? baseQuery.where(where) : baseQuery).limit(limit).offset(offset);

    const countQuery = db.select({ count: sql`count(*)` }).from(user);
    const [{ count }] = await (where ? countQuery.where(where) : countQuery);

    return [null, { users, total: Number(count), limit, offset }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to search users' }, null];
  }
};
