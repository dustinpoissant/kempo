import db from '../../db/index.js';
import { session, user } from '../../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

export default async ({ token }) => {
  if(!token){
    return [{ code: 400, msg: 'Session token is required' }, null];
  }
  
  try {
    const result = await db
      .select({
        session: session,
        user: user,
      })
      .from(session)
      .innerJoin(user, eq(session.userId, user.id))
      .where(and(
        eq(session.token, token),
        gt(session.expiresAt, new Date())
      ))
      .limit(1);
    
    if(result.length === 0){
      return [{ code: 404, msg: 'Session not found or expired' }, null];
    }
    
    return [null, {
      session: result[0].session,
      user: result[0].user,
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve session' }, null];
  }
};
