import crypto from 'crypto';
import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import getSetting from '../settings/getSetting.js';

export default async (userId) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  try {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const [error, sessionDurationDays] = await getSetting('system', 'session_duration_days', 7);
    
    if(error){
      return [error, null];
    }
    
    const expiresAt = new Date(Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    await db.insert(session).values({
      token: sessionToken,
      userId,
      expiresAt,
      createdAt: now,
    });

    return [null, {
      sessionToken,
      expiresAt,
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to create session' }, null];
  }
};
