import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (userId) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  try {
    await db.delete(session).where(eq(session.userId, userId));
    return [null, { userId }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to delete user sessions' }, null];
  }
};
