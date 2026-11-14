import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { guestSession } from '../../db/schema.js';
import { planHook, triggerPlannedHook } from '../hooks/triggerHook.js';

/*
  Deletes one guest. Before an unmerged guest goes, `guest:expired` fires with `{ tx, guestSessionId }` inside the same
  transaction so every extension removes what it keeps for that guest; a handler that throws keeps the guest. A merged
  guest owns nothing any more (its records moved to the account), so nothing is announced for it.

  `plan` is for a caller that deletes many: the handlers are read once (see `planHook`).
*/
export default async ({ token, plan }) => {
  if(!token){
    return [{ code: 400, msg: 'Guest token is required' }, null];
  }

  try {
    const hooks = plan ?? await planHook('guest:expired');

    return await db.transaction(async tx => {
      const [guest] = await tx.select().from(guestSession).where(eq(guestSession.token, token)).limit(1).for('update');
      if(!guest){
        return [{ code: 404, msg: 'Guest session not found' }, null];
      }

      if(!guest.mergedIntoUserId){
        await triggerPlannedHook(hooks, 'guest:expired', { tx, guestSessionId: token }, { bail: true });
      }

      await tx.delete(guestSession).where(eq(guestSession.token, token));

      return [null, { token }];
    });
  } catch(error){
    console.error(`[kempo] Deleting a guest session failed: ${error?.cause?.message ?? error?.message ?? error}`);
    return [{ code: 500, msg: 'Failed to delete guest session' }, null];
  }
};
