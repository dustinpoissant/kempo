import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export default async (userId, { limit = 50, offset = 0 } = {}) => {
  const sessions = await db.select()
    .from(session)
    .where(eq(session.userId, userId))
    .limit(limit)
    .offset(offset);
  
  const [{ count }] = await db.select({ count: sql`count(*)` })
    .from(session)
    .where(eq(session.userId, userId));
  
  return {
    sessions,
    total: Number(count),
    limit,
    offset
  };
};
