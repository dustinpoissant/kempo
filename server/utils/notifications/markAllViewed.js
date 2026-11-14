import { and, eq, inArray, isNull } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import { firstTime, recipientOf } from './helpers.js';

/*
  Marks everything a person has not viewed as viewed, or only what is of one `type` (the bell does this for notices,
  so reading the list does not hide a banner that has not been shown yet). Dismissed ones are left as they are.
*/
export default async ({ userId, guestSessionId, type } = {}) => {
  const state = recipientOf({ userId, guestSessionId });

  if(!state){
    return [{ code: 400, msg: 'User ID or guest session is required' }, null];
  }

  try {
    const now = new Date();
    const mine = and(eq(state.column, state.id), isNull(state.table.viewedAt), isNull(state.table.dismissedAt));
    const updated = await db
      .update(state.table)
      .set({ viewedAt: now, deliveredAt: firstTime(state.table.deliveredAt, now) })
      .where(type
        ? and(mine, inArray(state.table.notificationId, db.select({ id: notification.id }).from(notification).where(eq(notification.type, type))))
        : mine)
      .returning({ id: state.table.notificationId });

    return [null, { updated: updated.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to mark notifications as viewed' }, null];
  }
};
