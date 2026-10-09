import { and, eq, inArray, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification, notificationRecipient } from '../../db/schema.js';

/*
  Records that the action on a notification was taken, which also reads it. Names the notification by
  `notificationId`, or by `owner` and `dedupeKey` so the extension that raised it can resolve it without
  having kept the id; `userId` limits it to one person, and without it every recipient is updated.
*/
export default async ({ userId, notificationId, owner, dedupeKey } = {}) => {
  if(!notificationId && !(owner && dedupeKey)){
    return [{ code: 400, msg: 'Notification ID, or owner and dedupeKey, is required' }, null];
  }

  try {
    const target = notificationId
      ? eq(notificationRecipient.notificationId, notificationId)
      : inArray(notificationRecipient.notificationId, db.select({ id: notification.id }).from(notification).where(and(eq(notification.owner, owner), eq(notification.dedupeKey, dedupeKey))));

    const now = new Date().toISOString();

    const updated = await db
      .update(notificationRecipient)
      .set({
        handledAt: sql`coalesce(${notificationRecipient.handledAt}, ${now}::timestamp)`,
        readAt: sql`coalesce(${notificationRecipient.readAt}, ${now}::timestamp)`
      })
      .where(userId ? and(target, eq(notificationRecipient.userId, userId)) : target)
      .returning({ id: notificationRecipient.notificationId });

    if(!updated.length && notificationId){
      return [{ code: 404, msg: 'Notification not found' }, null];
    }

    return [null, { updated: updated.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to mark notification as handled' }, null];
  }
};
