import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

export default async ({ limit = 50, offset = 0 } = {}) => {
  try {
    const sessions = await db.select().from(session).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql`count(*)` }).from(session);
    
    return [null, {
      sessions,
      total: Number(count),
      limit,
      offset
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve sessions' }, null];
  }
};
