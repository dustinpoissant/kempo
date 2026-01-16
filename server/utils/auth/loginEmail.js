import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import getSetting from '../settings/getSetting.js';
import createSession from '../sessions/createSession.js';

export default async ({ email, password }) => {
  if(!email){
    return [{ code: 400, msg: 'Email is required' }, null];
  }
  
  if(!password){
    return [{ code: 400, msg: 'Password is required' }, null];
  }
  
  try {
    /*
      Get the User
    */
    const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if(existingUser.length === 0){
      return [{ code: 401, msg: 'Invalid email or password' }, null];
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
    const [settingError, requireEmailVerification] = await getSetting('system', 'require_email_verification', false);
    if(settingError){
      return [settingError, null];
    }
    
    if(requireEmailVerification && !emailVerified){
      return [{ code: 403, msg: 'Please verify your email before logging in. Check your inbox for the verification link.' }, null];
    }
    
    if(!await bcrypt.compare(password, passwordHash)){
      return [{ code: 401, msg: 'Invalid email or password' }, null];
    }
    
    const [sessionError, sessionData] = await createSession(userId);
    if(sessionError){
      return [sessionError, null];
    }
    
    return [null, {
      user: {
        id: userId,
        email,
        name,
        emailVerified
      },
      sessionToken: sessionData.sessionToken,
      expiresAt: sessionData.expiresAt,
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to login' }, null];
  }
};
