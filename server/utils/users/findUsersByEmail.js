import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { ilike, sql } from 'drizzle-orm';

export default async (searchTerm, { limit = 50, offset = 0 } = {}) => {
  const users = await db.select({
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
  }).from(user)
    .where(ilike(user.email, `%${searchTerm}%`))
    .limit(limit)
    .offset(offset);
  
  const [{ count }] = await db.select({ count: sql`count(*)` })
    .from(user)
    .where(ilike(user.email, `%${searchTerm}%`));
  
  return {
    users,
    total: Number(count),
    limit,
    offset,
    searchTerm
  };
};
