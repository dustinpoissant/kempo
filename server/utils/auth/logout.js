import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ headers }) => {
  const cookieHeader = headers.cookie || headers.Cookie;
  
  if(!cookieHeader) return null;
  
  const sessionToken = cookieHeader.split(';')
    .find(c => c.trim().startsWith('session_token='))
    ?.split('=')[1]?.trim();
  
  if(!sessionToken) return null;
  
  await db.delete(session).where(eq(session.token, sessionToken));
  return { success: true };
};
