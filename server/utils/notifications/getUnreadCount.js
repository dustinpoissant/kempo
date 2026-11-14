import { and, eq, isNull, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import { isName, notExpired, recipientOf } from './helpers.js';

/* How many notifications a person has not viewed, not counting dismissed or expired ones, optionally of one `type`. */
export default async ({ userId, guestSessionId, type } = {}) => {
  const state = recipientOf({ userId, guestSessionId });

  if(!state){
    return [{ code: 400, msg: 'User ID or guest session is required' }, null];
  }

  if(type !== undefined && !isName(type)){
    return [{ code: 400, msg: 'Type must be a type name' }, null];
  }

  try {
    const [{ count }] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(state.table)
      .innerJoin(notification, eq(notification.id, state.table.notificationId))
      .where(and(
        eq(state.column, state.id),
        isNull(state.table.viewedAt),
        isNull(state.table.dismissedAt),
        notExpired(new Date()),
        type ? eq(notification.type, type) : undefined
      ));

    return [null, { count }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to count unread notifications' }, null];
  }
};
