import { and, eq, inArray } from 'drizzle-orm';
import db from '../../db/index.js';
import { firstTime, recipientOf } from './helpers.js';

/* Records that a browser fetched these notifications. It keeps the first time. */
export default async ({ userId, guestSessionId, notificationIds } = {}) => {
  const state = recipientOf({ userId, guestSessionId });

  if(!state || !Array.isArray(notificationIds) || notificationIds.some(id => typeof id !== 'string')){
    return [{ code: 400, msg: 'User ID or guest session, and an array of notification ids, are required' }, null];
  }

  if(!notificationIds.length){
    return [null, { updated: 0 }];
  }

  try {
    const updated = await db
      .update(state.table)
      .set({ deliveredAt: firstTime(state.table.deliveredAt, new Date()) })
      .where(and(eq(state.column, state.id), inArray(state.table.notificationId, notificationIds)))
      .returning({ id: state.table.notificationId });

    return [null, { updated: updated.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to mark notifications as delivered' }, null];
  }
};
