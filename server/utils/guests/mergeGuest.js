import { and, eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { guestSession, notificationGuestRecipient, notificationRecipient, user } from '../../db/schema.js';
import triggerHook, { planHook, triggerPlannedHook } from '../hooks/triggerHook.js';

const earliest = (a, b) => (a && b ? (a < b ? a : b) : a ?? b);

const latest = (a, b) => (a && b ? (a > b ? a : b) : a ?? b);

/*
  Moves everything a guest owns to a user, when the visitor logs in or registers. Both are the same here: the account
  may be ten years old or ten seconds old, and it holds what the visitor did before.

  It is one database transaction. Kempo moves its own rows, then fires `guest:merged` with `{ tx, guestSessionId, userId }`
  and waits for every handler, so an extension moves what it keeps for the guest in the same transaction. A handler that
  throws undoes the whole merge and nothing is half moved. Handlers must write through `tx`, and should be quick.

  A guest that is missing is a 404 and one already merged is a 409, so a second tab finishing a login is not a failure
  worth stopping it for. Anything else is a 500.

  A notification the user already has is not duplicated: the earliest read is kept, and the latest handled and dismissed.

  After the commit, `guest:merged:committed` fires with `{ guestSessionId, userId, results }`, where `results` is what each
  `guest:merged` handler returned. It is for anything that must only happen once the merge has really happened, such as a
  notice to the person, so a rolled-back merge never announces anything.
*/
export default async ({ guestSessionId, userId }) => {
  if(!guestSessionId){
    return [{ code: 400, msg: 'Guest session is required' }, null];
  }

  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  try {
    /* Read before the transaction opens, so the hook does not need the database while the transaction holds it. */
    const plan = await planHook('guest:merged');

    const [error, merged] = await db.transaction(async tx => {
      const [target] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
      if(!target){
        return [{ code: 404, msg: 'User not found' }, null];
      }

      const [guest] = await tx.select().from(guestSession).where(eq(guestSession.token, guestSessionId)).limit(1).for('update');
      if(!guest){
        return [{ code: 404, msg: 'Guest session not found' }, null];
      }
      if(guest.mergedIntoUserId){
        return [{ code: 409, msg: 'Guest session has already been merged' }, null];
      }

      const sent = await tx.select().from(notificationGuestRecipient).where(eq(notificationGuestRecipient.guestSessionId, guestSessionId));

      for(const row of sent){
        const key = and(eq(notificationRecipient.notificationId, row.notificationId), eq(notificationRecipient.userId, userId));
        const [held] = await tx.select().from(notificationRecipient).where(key).limit(1);

        if(held){
          await tx.update(notificationRecipient).set({
            readAt: earliest(held.readAt, row.readAt),
            handledAt: latest(held.handledAt, row.handledAt),
            dismissedAt: latest(held.dismissedAt, row.dismissedAt),
          }).where(key);
        } else {
          await tx.insert(notificationRecipient).values({
            notificationId: row.notificationId,
            userId,
            readAt: row.readAt,
            handledAt: row.handledAt,
            dismissedAt: row.dismissedAt,
          });
        }
      }

      await tx.delete(notificationGuestRecipient).where(eq(notificationGuestRecipient.guestSessionId, guestSessionId));
      await tx.update(guestSession).set({ mergedIntoUserId: userId, mergedAt: new Date() }).where(eq(guestSession.token, guestSessionId));

      const { results } = (await triggerPlannedHook(plan, 'guest:merged', { tx, guestSessionId, userId }, { bail: true }))[1];

      return [null, { notifications: sent.length, results }];
    });

    if(error) return [error, null];

    await triggerHook('guest:merged:committed', { guestSessionId, userId, results: merged.results });

    return [null, { merged: true, notifications: merged.notifications }];
  } catch(error){
    console.error(`[kempo] Merging guest session into user ${userId} failed: ${error?.cause?.message ?? error?.message ?? error}`);
    return [{ code: 500, msg: 'Failed to merge guest session' }, null];
  }
};
