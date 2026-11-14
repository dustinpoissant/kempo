import { desc, eq, isNotNull, isNull, count } from 'drizzle-orm';
import db from '../../db/index.js';
import { guestSession, user } from '../../db/schema.js';

/*
  Guest sessions, most recently seen first. `merged` is 'merged' or 'unmerged' to filter, anything else for all of
  them. A merged guest carries the user it went into, as { id, name, email }, or null if that user has been deleted.
  `counts` is every guest regardless of the filter, for the screen's totals.
*/
export default async ({ merged, limit = 25, offset = 0 } = {}) => {
  const size = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const skip = Math.max(Number(offset) || 0, 0);
  const filter = merged === 'merged' ? isNotNull(guestSession.mergedIntoUserId) : merged === 'unmerged' ? isNull(guestSession.mergedIntoUserId) : undefined;

  try {
    const rows = await db
      .select({
        token: guestSession.token,
        createdAt: guestSession.createdAt,
        lastSeenAt: guestSession.lastSeenAt,
        mergedAt: guestSession.mergedAt,
        mergedIntoUserId: guestSession.mergedIntoUserId,
        userName: user.name,
        userEmail: user.email,
      })
      .from(guestSession)
      .leftJoin(user, eq(user.id, guestSession.mergedIntoUserId))
      .where(filter)
      .orderBy(desc(guestSession.lastSeenAt), desc(guestSession.token))
      .limit(size)
      .offset(skip);

    const [{ value: total }] = await db.select({ value: count() }).from(guestSession).where(filter);
    const [{ value: mergedTotal }] = await db.select({ value: count() }).from(guestSession).where(isNotNull(guestSession.mergedIntoUserId));
    const [{ value: all }] = await db.select({ value: count() }).from(guestSession);

    return [null, {
      guests: rows.map(({ userName, userEmail, ...row }) => ({
        ...row,
        user: row.mergedIntoUserId && userEmail ? { id: row.mergedIntoUserId, name: userName, email: userEmail } : null,
      })),
      total,
      limit: size,
      offset: skip,
      counts: { all, merged: mergedTotal, unmerged: all - mergedTotal },
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to list guest sessions' }, null];
  }
};
