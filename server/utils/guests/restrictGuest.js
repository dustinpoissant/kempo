import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { guestSession } from '../../db/schema.js';

/*
  Restricts a guest, or lifts it with `restricted: false`. A restricted guest has no permissions at all (and
  cannot register), and its browser keeps the restriction when the guest cookie is cleared (see middleware/kempo.js). A restricted
  guest is not deleted for being idle, since it is the record of the restriction.
*/
export default async ({ token, restricted = true }) => {
  if(!token){
    return [{ code: 400, msg: 'Guest token is required' }, null];
  }

  try {
    const [guest] = await db.update(guestSession)
      .set({ restrictedAt: restricted ? new Date() : null })
      .where(eq(guestSession.token, token))
      .returning({ token: guestSession.token, restrictedAt: guestSession.restrictedAt });

    if(!guest){
      return [{ code: 404, msg: 'Guest session not found' }, null];
    }

    return [null, guest];
  } catch(error){
    return [{ code: 500, msg: 'Failed to restrict the guest session' }, null];
  }
};
