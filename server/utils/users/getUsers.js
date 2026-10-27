import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { sql, asc, ilike, or } from 'drizzle-orm';

export default async ({ q = '', limit = 50, offset = 0 } = {}) => {
  try {
    const where = q ? or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`)) : undefined;

    const baseQuery = db.select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    }).from(user);

    const users = await (where ? baseQuery.where(where) : baseQuery).orderBy(asc(user.createdAt)).limit(limit).offset(offset);

    const countQuery = db.select({ count: sql`count(*)` }).from(user);
    const [{ count }] = await (where ? countQuery.where(where) : countQuery);

    return [null, {
      users,
      total: Number(count),
      limit,
      offset
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve users' }, null];
  }
};
