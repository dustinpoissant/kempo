import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq, lt, and } from 'drizzle-orm';

export default async (userId) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  try {
    const deleted = await db.delete(session)
      .where(and(
        eq(session.userId, userId),
        lt(session.expiresAt, new Date())
      ))
      .returning();

    return [null, { deleted: deleted.length }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to delete expired sessions' }, null];
  }
};
