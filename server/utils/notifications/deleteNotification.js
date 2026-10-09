import { and, eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification, notificationRecipient } from '../../db/schema.js';

/*
  Removes a notification for one person (`userId`), which hides it from their list and count but leaves
  everyone else's copy and the stored row alone, or for everyone (`everyone: true`), which deletes it.
  The HTTP routes only ever dismiss for the signed-in user; deleting for everyone is for server code.
*/
export default async ({ notificationId, userId, everyone = false } = {}) => {
  if(!notificationId){
    return [{ code: 400, msg: 'Notification ID is required' }, null];
  }

  if(!everyone && !userId){
    return [{ code: 400, msg: 'User ID is required unless deleting for everyone' }, null];
  }

  try {
    const removed = everyone
      ? await db.delete(notification).where(eq(notification.id, notificationId)).returning({ id: notification.id })
      : await db
        .update(notificationRecipient)
        .set({ dismissedAt: new Date() })
        .where(and(eq(notificationRecipient.userId, userId), eq(notificationRecipient.notificationId, notificationId)))
        .returning({ id: notificationRecipient.notificationId });

    if(!removed.length){
      return [{ code: 404, msg: 'Notification not found' }, null];
    }

    return [null, { id: notificationId }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to delete notification' }, null];
  }
};
