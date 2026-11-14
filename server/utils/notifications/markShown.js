import { and, eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { firstTime, recipientOf } from './helpers.js';

/*
  Records that a notification was put in front of the person, which starts the wait before one that must be
  acknowledged is shown again. Showing it also delivers it.
*/
export default async ({ userId, guestSessionId, notificationId } = {}) => {
  const state = recipientOf({ userId, guestSessionId });

  if(!state || !notificationId){
    return [{ code: 400, msg: 'User ID or guest session, and notification ID, are required' }, null];
  }

  try {
    const now = new Date();
    const updated = await db
      .update(state.table)
      .set({ lastShownAt: now, deliveredAt: firstTime(state.table.deliveredAt, now) })
      .where(and(eq(state.column, state.id), eq(state.table.notificationId, notificationId)))
      .returning({ id: state.table.notificationId });

    if(!updated.length){
      return [{ code: 404, msg: 'Notification not found' }, null];
    }

    return [null, { id: notificationId }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to mark notification as shown' }, null];
  }
};
