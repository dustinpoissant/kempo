import { and, eq, isNull } from 'drizzle-orm';
import db from '../../db/index.js';
import { guestSession } from '../../db/schema.js';
import { TOUCH_INTERVAL_MS } from './constants.js';

/*
  Finds a guest that has not been merged. A guest that has been merged into an account no longer exists as far as a
  visitor is concerned. `touched` says the last-seen time moved on, which is when the cookie is renewed too.
*/
export default async ({ token, now = new Date() }) => {
  if(!token){
    return [{ code: 400, msg: 'Guest token is required' }, null];
  }

  try {
    const [guest] = await db.select().from(guestSession)
      .where(and(eq(guestSession.token, token), isNull(guestSession.mergedIntoUserId)))
      .limit(1);

    if(!guest){
      return [{ code: 404, msg: 'Guest session not found' }, null];
    }

    const touched = now.getTime() - guest.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS;
    if(touched){
      await db.update(guestSession).set({ lastSeenAt: now }).where(eq(guestSession.token, token));
    }

    return [null, { guest: touched ? { ...guest, lastSeenAt: now } : guest, touched }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve guest session' }, null];
  }
};
