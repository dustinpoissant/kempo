import { and, eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import { recipientOf } from './helpers.js';

/*
  Dismisses a notification for one person (`userId` or `guestSessionId`), which hides it from what they have but
  keeps it in their history and leaves everyone else's copy and the stored row alone, or deletes it for everyone
  (`everyone: true`). The HTTP routes only ever dismiss for the caller; deleting for everyone is for server code.
*/
export default async ({ notificationId, userId, guestSessionId, everyone = false } = {}) => {
  if(!notificationId){
    return [{ code: 400, msg: 'Notification ID is required' }, null];
  }

  const state = recipientOf({ userId, guestSessionId });

  if(!everyone && !state){
    return [{ code: 400, msg: 'User ID or guest session is required unless deleting for everyone' }, null];
  }

  try {
    const removed = everyone
      ? await db.delete(notification).where(eq(notification.id, notificationId)).returning({ id: notification.id })
      : await db
        .update(state.table)
        .set({ dismissedAt: new Date() })
        .where(and(eq(state.column, state.id), eq(state.table.notificationId, notificationId)))
        .returning({ id: state.table.notificationId });

    if(!removed.length){
      return [{ code: 404, msg: 'Notification not found' }, null];
    }

    return [null, { id: notificationId }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to delete notification' }, null];
  }
};
