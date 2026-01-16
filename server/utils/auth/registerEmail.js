import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import getSetting from '../settings/getSetting.js';
import sendVerificationEmail from './sendVerificationEmail.js';
import createSession from '../sessions/createSession.js';

const generateId = () => crypto.randomBytes(16).toString('hex');

export default async ({ email, password, name }) => {
  if(!email){
    return [{ code: 400, msg: 'Email is required' }, null];
  }
  
  if(!password){
    return [{ code: 400, msg: 'Password is required' }, null];
  }
  
  if(!name){
    return [{ code: 400, msg: 'Name is required' }, null];
  }
  
  try {
    /* Is registration allowed */
    const [settingError, allowRegistration] = await getSetting('system', 'allow_registration', true);
    if(settingError){
      return [settingError, null];
    }
    
    if(!allowRegistration){
      return [{ code: 403, msg: 'Registration is currently disabled' }, null];
    }
    
    /* Does a user with this email address already exist? */
    const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if(existingUser.length > 0){
      return [{ code: 409, msg: 'User already exists with this email' }, null];
    }
    
    /* Create the User */
    const userId = generateId();
    const now = new Date();
    await db.insert(user).values({
      id: userId,
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    
    /* Is Email Verification Required? */
    const [verifySettingError, requiresVerification] = await getSetting('system', 'require_email_verification', false);
    if(verifySettingError){
      return [verifySettingError, null];
    }
    
    if(requiresVerification){
      const [verifyEmailError] = await sendVerificationEmail({
        userId,
        email,
        name,
      });
      
      if(verifyEmailError){
        return [verifyEmailError, null];
      }

      return [null, {
        user: {
          id: userId,
          email,
          name,
          emailVerified: false,
        },
        requiresVerification,
        sessionToken: null,
        expiresAt: null
      }];
    }
    
    /* Login */
    const [sessionError, sessionData] = await createSession(userId);
    if(sessionError){
      return [sessionError, null];
    }
    
    return [null, {
      user: {
        id: userId,
        email,
        name,
        emailVerified: false,
      },
      requiresVerification,
      sessionToken: sessionData.sessionToken,
      expiresAt: sessionData.expiresAt,
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to register user' }, null];
  }
};
