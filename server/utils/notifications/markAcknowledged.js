import { and, eq, inArray } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification, notificationRecipient, notificationGuestRecipient } from '../../db/schema.js';
import { firstTime, recipientOf } from './helpers.js';

/*
  Records that the person acknowledged a notification (clicked its button, or confirmed it), which also marks it
  viewed and delivered. Names the notification by `notificationId`, or by `owner` and `dedupeKey` so the extension
  that raised it can resolve it without having kept the id. `userId` or `guestSessionId` limits it to one person;
  without either, every recipient, signed in or guest, is updated.
*/
export default async ({ userId, guestSessionId, notificationId, owner, dedupeKey } = {}) => {
  if(!notificationId && !(owner && dedupeKey)){
    return [{ code: 400, msg: 'Notification ID, or owner and dedupeKey, is required' }, null];
  }

  try {
    const now = new Date();
    const person = recipientOf({ userId, guestSessionId });
    const tables = person ? [person] : [
      { table: notificationRecipient, column: null },
      { table: notificationGuestRecipient, column: null },
    ];
    let updatedCount = 0;

    for(const { table, column, id } of tables){
      const target = notificationId
        ? eq(table.notificationId, notificationId)
        : inArray(table.notificationId, db.select({ id: notification.id }).from(notification).where(and(eq(notification.owner, owner), eq(notification.dedupeKey, dedupeKey))));

      const updated = await db
        .update(table)
        .set({
          acknowledgedAt: firstTime(table.acknowledgedAt, now),
          viewedAt: firstTime(table.viewedAt, now),
          deliveredAt: firstTime(table.deliveredAt, now),
        })
        .where(column ? and(target, eq(column, id)) : target)
        .returning({ id: table.notificationId });

      updatedCount += updated.length;
    }

    if(!updatedCount && notificationId){
      return [{ code: 404, msg: 'Notification not found' }, null];
    }

    return [null, { updated: updatedCount }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to acknowledge notification' }, null];
  }
};
