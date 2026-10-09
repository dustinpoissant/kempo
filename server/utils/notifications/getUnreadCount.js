import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification, notificationRecipient } from '../../db/schema.js';

export default async ({ userId } = {}) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  try {
    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(notificationRecipient)
      .innerJoin(notification, eq(notification.id, notificationRecipient.notificationId))
      .where(and(
        eq(notificationRecipient.userId, userId),
        isNull(notificationRecipient.readAt),
        isNull(notificationRecipient.dismissedAt),
        or(isNull(notification.expiresAt), gt(notification.expiresAt, new Date()))
      ));

    return [null, { count }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to count unread notifications' }, null];
  }
};
