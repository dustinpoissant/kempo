import { lt } from 'drizzle-orm';
import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import getSetting from '../settings/getSetting.js';

/*
  Deletes every session that expired more than `system:session_cleanup_hours` ago (default 24), for every user.
  Run hourly by the scheduler (middleware/kempo.js registers it). 0 keeps expired sessions forever, and the
  per-user "clear expired" button still works either way.
*/
export default async ({ now = new Date(), hours } = {}) => {
  try {
    let cutoffHours = hours;

    if(cutoffHours === undefined){
      const [, stored] = await getSetting('system', 'session_cleanup_hours', 24);
      cutoffHours = Number(stored);
      if(!Number.isFinite(cutoffHours) || cutoffHours < 0) cutoffHours = 24;
    }

    if(cutoffHours === 0) return [null, { deleted: 0 }];

    const removed = await db
      .delete(session)
      .where(lt(session.expiresAt, new Date(now.getTime() - cutoffHours * 3600000)))
      .returning({ token: session.token });

    return [null, { deleted: removed.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to delete expired sessions' }, null];
  }
};
