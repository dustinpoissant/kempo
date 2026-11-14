import crypto from 'crypto';
import db from '../../db/index.js';
import { guestSession } from '../../db/schema.js';

/* Starts a guest session. The token is the guest's identity and goes in a cookie, so it is as secret as a login token. */
export default async () => {
  try {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();

    await db.insert(guestSession).values({ token, createdAt: now, lastSeenAt: now });

    return [null, { token, createdAt: now }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to create guest session' }, null];
  }
};
