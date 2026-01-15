import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getSetting } from '../settings/settings.js';
import sendVerificationEmail from './sendVerificationEmail.js';
import createSession from '../sessions/createSession.js';

const generateId = () => crypto.randomBytes(16).toString('hex');

export default async ({ email, password, name }) => {
	/* Is registration allowed */
  if(!await getSetting('system', 'allow_registration', true)){
    return { error: 'Registration is currently disabled', statusCode: 403 };
  }
  
	/* Does a user with this email address already exist? */
  const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if(existingUser.length > 0){
    return { error: 'User already exists with this email', statusCode: 409 };
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
	const requiresVerification = await getSetting('system', 'require_email_verification', false);
  if(requiresVerification){
    await sendVerificationEmail({
      userId,
      email,
      name,
    });

    return { // return early before creating the session
      user: {
        id: userId,
        email,
        name,
        emailVerified: false,
      },
      requiresVerification,
			sessionToken: null,
    	expiresAt: null
    };
  }
  
	/* Login */
  const { sessionToken, expiresAt } = await createSession(userId);
  
  return {
    user: {
      id: userId,
      email,
      name,
      emailVerified: false,
    },
		requiresVerification,
    sessionToken,
    expiresAt,
  };
};
