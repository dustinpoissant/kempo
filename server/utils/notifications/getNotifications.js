import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import { MAX_PAGE_SIZE, isName, isStatusFilter, notExpired, present, recipientOf, selection, statusCondition } from './helpers.js';

/*
  One person's notifications, highest priority first and then most recently raised. A person is a user
  (`userId`) or a guest (`guestSessionId`).

  `status` is `active` (the default: not dismissed and not expired, which is what a bell shows), `all` (a
  history, dismissed ones included), or one of pending, delivered, viewed, acknowledged, dismissed and expired.
  `type` keeps one kind. `unreadOnly` keeps what has not been viewed.

  `total` counts what the filter matches and `unread` counts what the person still has unviewed of that
  `type`, whatever the status, so a badge and a paginated list come from the same call.
*/
export default async ({ userId, guestSessionId, type, status, unreadOnly = false, limit = 20, offset = 0 } = {}) => {
  const state = recipientOf({ userId, guestSessionId });

  if(!state){
    return [{ code: 400, msg: 'User ID or guest session is required' }, null];
  }

  if(!isStatusFilter(status)){
    return [{ code: 400, msg: 'Status must be all, active, pending, delivered, viewed, acknowledged, dismissed or expired' }, null];
  }

  if(type !== undefined && !isName(type)){
    return [{ code: 400, msg: 'Type must be a type name' }, null];
  }

  const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), MAX_PAGE_SIZE);
  const skip = Math.max(Number.parseInt(offset, 10) || 0, 0);

  try {
    const now = new Date();
    const mine = and(eq(state.column, state.id), type ? eq(notification.type, type) : undefined);
    const unviewed = and(mine, notExpired(now), isNull(state.table.dismissedAt), isNull(state.table.viewedAt));
    const matching = and(mine, statusCondition(state, status ?? 'active', now));

    const rows = await db
      .select(selection(state))
      .from(state.table)
      .innerJoin(notification, eq(notification.id, state.table.notificationId))
      .where(unreadOnly ? and(matching, isNull(state.table.viewedAt)) : matching)
      .orderBy(desc(notification.priority), desc(notification.updatedAt), desc(notification.id))
      .limit(pageSize)
      .offset(skip);

    const [counts] = await db
      .select({
        all: sql`count(*) filter (where ${matching ?? sql`true`})`.mapWith(Number),
        matchingUnread: sql`count(*) filter (where ${matching ?? sql`true`} and ${state.table.viewedAt} is null)`.mapWith(Number),
        unread: sql`count(*) filter (where ${unviewed})`.mapWith(Number),
      })
      .from(state.table)
      .innerJoin(notification, eq(notification.id, state.table.notificationId))
      .where(eq(state.column, state.id));

    return [null, {
      notifications: rows.map(row => present(row, now)),
      total: unreadOnly ? counts.matchingUnread : counts.all,
      unread: counts.unread,
      limit: pageSize,
      offset: skip,
    }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to retrieve notifications' }, null];
  }
};
