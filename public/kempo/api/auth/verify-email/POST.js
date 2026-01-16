import crypto from 'crypto';
import verifyEmail from '../../../../../server/utils/auth/verifyEmail.js';
import db from '../../../../../server/db/index.js';
import { session, user } from '../../../../../server/db/schema.js';
import { eq } from 'drizzle-orm';
import getSetting from '../../../../../server/utils/settings/getSetting.js';

const generateToken = () => crypto.randomBytes(32).toString('hex');

export default async (request, response) => {
  try {
    const { token } = await request.json();
    
    const [error, result] = await verifyEmail({ token });
    
    if(error){
      return response.status(error.code).json({ error: error.msg });
    }

    const userRecord = await db
      .select()
      .from(user)
      .where(eq(user.id, result.userId))
      .limit(1);

    if(userRecord.length === 0){
      return response.status(500).json({ error: 'User not found' });
    }

    const sessionToken = generateToken();
    const [settingError, sessionDurationDays] = await getSetting('system', 'session_duration_days', 7);
    
    if(settingError){
      return response.status(settingError.code).json({ error: settingError.msg });
    }
    
    const expiresAt = new Date(Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    await db.insert(session).values({
      token: sessionToken,
      userId: result.userId,
      expiresAt,
      createdAt: now,
    });

    response.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionDurationDays * 24 * 60 * 60 * 1000
    });

    response.json({ 
      success: true,
      user: {
        id: userRecord[0].id,
        email: userRecord[0].email,
        name: userRecord[0].name,
        emailVerified: userRecord[0].emailVerified,
      }
    });
  } catch(error){
    console.error('Email verification error:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
};
