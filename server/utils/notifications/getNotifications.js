import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification, notificationRecipient } from '../../db/schema.js';
import { MAX_PAGE_SIZE } from './helpers.js';

/*
  One person's notifications, most recently raised first. Dismissed and expired ones are left out. `total`
  counts what the filter matches, `unread` counts every unread one whatever the filter, so a bell badge
  and a paginated list can come from the same call.
*/
export default async ({ userId, unreadOnly = false, limit = 20, offset = 0 } = {}) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), MAX_PAGE_SIZE);
  const skip = Math.max(Number.parseInt(offset, 10) || 0, 0);

  try {
    const now = new Date();
    const visible = and(
      eq(notificationRecipient.userId, userId),
      isNull(notificationRecipient.dismissedAt),
      or(isNull(notification.expiresAt), gt(notification.expiresAt, now))
    );

    const rows = await db
      .select({
        id: notification.id,
        owner: notification.owner,
        title: notification.title,
        message: notification.message,
        level: notification.level,
        actions: notification.actions,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
        readAt: notificationRecipient.readAt,
        handledAt: notificationRecipient.handledAt
      })
      .from(notificationRecipient)
      .innerJoin(notification, eq(notification.id, notificationRecipient.notificationId))
      .where(unreadOnly ? and(visible, isNull(notificationRecipient.readAt)) : visible)
      .orderBy(desc(notification.updatedAt), desc(notification.id))
      .limit(pageSize)
      .offset(skip);

    const [counts] = await db
      .select({
        all: sql`count(*)`.mapWith(Number),
        unread: sql`count(*) filter (where ${notificationRecipient.readAt} is null)`.mapWith(Number)
      })
      .from(notificationRecipient)
      .innerJoin(notification, eq(notification.id, notificationRecipient.notificationId))
      .where(visible);

    return [null, {
      notifications: rows,
      total: unreadOnly ? counts.unread : counts.all,
      unread: counts.unread,
      limit: pageSize,
      offset: skip
    }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to retrieve notifications' }, null];
  }
};
