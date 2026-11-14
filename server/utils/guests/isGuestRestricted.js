import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { guestSession } from '../../db/schema.js';

/* Whether the guest with this token is restricted. A token that matches no guest is not. Reads only: it does not renew the guest. */
export default async ({ token }) => {
  if(!token){
    return [{ code: 400, msg: 'Guest token is required' }, null];
  }

  try {
    const [guest] = await db.select({ restrictedAt: guestSession.restrictedAt }).from(guestSession).where(eq(guestSession.token, token)).limit(1);
    return [null, !!guest?.restrictedAt];
  } catch(error){
    return [{ code: 500, msg: 'Failed to check the guest session' }, null];
  }
};
