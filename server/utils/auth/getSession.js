import db from '../../db/index.js';
import { session, user } from '../../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';

export default async ({ token }) => {
  if(!token) return null;
  
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
  
  if(result.length === 0) return null;
  
  return {
    session: result[0].session,
    user: result[0].user,
  };
};
