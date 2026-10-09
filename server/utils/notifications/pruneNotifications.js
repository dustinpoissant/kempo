import { lt, lte, or, and, isNotNull } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import getSetting from '../settings/getSetting.js';
import { DEFAULT_RETENTION_DAYS } from './helpers.js';

/*
  Deletes notifications, with their per-person state, that have expired or that were last raised longer
  ago than the retention. Retention is the `system:notification_retention_days` setting (default 90);
  0 keeps history forever, and an expiry set by the sender is still honoured.
*/
export default async ({ now = new Date(), retentionDays } = {}) => {
  try {
    let days = retentionDays;

    if(days === undefined){
      const [, stored] = await getSetting('system', 'notification_retention_days', DEFAULT_RETENTION_DAYS);
      days = Number(stored);
      if(!Number.isFinite(days) || days < 0) days = DEFAULT_RETENTION_DAYS;
    }

    const expired = and(isNotNull(notification.expiresAt), lte(notification.expiresAt, now));
    const stale = days > 0 ? lt(notification.updatedAt, new Date(now.getTime() - days * 86400000)) : undefined;

    const removed = await db
      .delete(notification)
      .where(stale ? or(expired, stale) : expired)
      .returning({ id: notification.id });

    return [null, { deleted: removed.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to prune notifications' }, null];
  }
};
