import { and, eq, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { notificationRecipient } from '../../db/schema.js';

/* Marking an already read notification read keeps its original time. */
export default async ({ userId, notificationId } = {}) => {
  if(!userId || !notificationId){
    return [{ code: 400, msg: 'User ID and notification ID are required' }, null];
  }

  try {
    const updated = await db
      .update(notificationRecipient)
      .set({ readAt: sql`coalesce(${notificationRecipient.readAt}, ${new Date().toISOString()}::timestamp)` })
      .where(and(eq(notificationRecipient.userId, userId), eq(notificationRecipient.notificationId, notificationId)))
      .returning({ id: notificationRecipient.notificationId });

    if(!updated.length){
      return [{ code: 404, msg: 'Notification not found' }, null];
    }

    return [null, { id: notificationId }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to mark notification as read' }, null];
  }
};
