import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

export default async ({ limit = 50, offset = 0 } = {}) => {
  const users = await db.select({
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  }).from(user).limit(limit).offset(offset);
  
  const [{ count }] = await db.select({ count: sql`count(*)` }).from(user);
  
  return {
    users,
    total: Number(count),
    limit,
    offset
  };
};
