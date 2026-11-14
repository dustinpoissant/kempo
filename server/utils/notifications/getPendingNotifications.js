import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import getNotificationConfig from './getNotificationConfig.js';
import getUnreadCount from './getUnreadCount.js';
import { notExpired, present, recipientOf, selection } from './helpers.js';

const LIMIT = 50;

/*
  What a browser should put in front of a person now. It is a read and changes nothing: the browser reports what
  it did (delivered, shown, viewed, acknowledged, dismissed) afterwards.

  A person's `notice`s are not here, since they wait in the bell until it is opened. Everything else is:
  `toast`, `banner`, `modal` and `inline`, and any type an extension made up, for whatever the extension put on
  the page to receive it. Dismissed, acknowledged and expired ones are never here. One that must be acknowledged
  (and a `modal` always must) stays until it is acknowledged, coming back once its cooldown has passed since it
  was last shown. Any other is here until it has been viewed.

  A modal comes first, then higher priority, then the one raised earliest. `unreadNotices` is how many notices the
  person has not viewed, for a bell, so the browser needs one request and not two.
*/
export default async ({ userId, guestSessionId, now = new Date() } = {}) => {
  const state = recipientOf({ userId, guestSessionId });

  if(!state){
    return [{ code: 400, msg: 'User ID or guest session is required' }, null];
  }

  try {
    const [, config] = await getNotificationConfig();
    const cooldown = sql`make_interval(secs => coalesce(${notification.cooldownSeconds}, ${config.cooldownSeconds}))`;

    const rows = await db
      .select(selection(state))
      .from(state.table)
      .innerJoin(notification, eq(notification.id, state.table.notificationId))
      .where(and(
        eq(state.column, state.id),
        sql`${notification.type} <> 'notice'`,
        isNull(state.table.dismissedAt),
        isNull(state.table.acknowledgedAt),
        notExpired(now),
        or(
          and(eq(notification.mustAcknowledge, false), isNull(state.table.viewedAt)),
          and(eq(notification.mustAcknowledge, true), or(isNull(state.table.lastShownAt), sql`${state.table.lastShownAt} + ${cooldown} <= ${now.toISOString()}::timestamp`))
        )
      ))
      .orderBy(sql`case when ${notification.type} = 'modal' then 0 else 1 end`, desc(notification.priority), asc(notification.updatedAt), asc(notification.id))
      .limit(LIMIT);

    const [, notices] = await getUnreadCount({ userId, guestSessionId, type: 'notice' });

    return [null, { notifications: rows.map(row => present(row, now)), config, unreadNotices: notices?.count ?? 0 }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to retrieve pending notifications' }, null];
  }
};
