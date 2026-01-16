import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ token }) => {
  if(!token){
    return [{ code: 400, msg: 'Session token is required' }, null];
  }
  
  try {
    await db.delete(session).where(eq(session.token, token));
    return [null, { success: true }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to logout' }, null];
  }
};
