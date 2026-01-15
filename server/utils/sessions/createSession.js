import crypto from 'crypto';
import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { getSetting } from '../settings/settings.js';

export default async (userId) => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const sessionDurationDays = await getSetting('system', 'session_duration_days', 7);
  const expiresAt = new Date(Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  
  await db.insert(session).values({
    token: sessionToken,
    userId,
    expiresAt,
    createdAt: now,
  });

  return {
    sessionToken,
    expiresAt,
  };
};
