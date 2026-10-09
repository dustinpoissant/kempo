import { and, eq, isNull } from 'drizzle-orm';
import db from '../../db/index.js';
import { notificationRecipient } from '../../db/schema.js';

export default async ({ userId } = {}) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  try {
    const updated = await db
      .update(notificationRecipient)
      .set({ readAt: new Date() })
      .where(and(eq(notificationRecipient.userId, userId), isNull(notificationRecipient.readAt), isNull(notificationRecipient.dismissedAt)))
      .returning({ id: notificationRecipient.notificationId });

    return [null, { updated: updated.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to mark notifications as read' }, null];
  }
};
