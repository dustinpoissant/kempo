import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getSetting } from '../settings/settings.js';
import createSession from '../sessions/createSession.js';

export default async ({ email, password }) => {
  /*
    Get the User
  */
  const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if(existingUser.length === 0){
    return { error: 'Invalid email or password' };
  }
  const {
    emailVerified,
    id: userId,
    name,
    passwordHash
  } = existingUser[0];
  
  /*
    Is verification required? If so are they verified?
  */
  if((await getSetting('system', 'require_email_verification', false)) && !emailVerified){
    return { 
      error: 'Please verify your email before logging in. Check your inbox for the verification link.',
      statusCode: 403
    };
  }
  
  if(!await bcrypt.compare(password, passwordHash)){
    return { error: 'Invalid email or password' };
  }
  
  const { sessionToken, expiresAt } = await createSession(userId);
  
  return {
    user: {
      id: userId,
      email,
      name,
      emailVerified
    },
    sessionToken,
    expiresAt,
  };
};
