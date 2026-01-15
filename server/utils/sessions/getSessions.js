import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

export default async ({ limit = 50, offset = 0 } = {}) => {
  const sessions = await db.select().from(session).limit(limit).offset(offset);
  const [{ count }] = await db.select({ count: sql`count(*)` }).from(session);
  
  return {
    sessions,
    total: Number(count),
    limit,
    offset
  };
};
