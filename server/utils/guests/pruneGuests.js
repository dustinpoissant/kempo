import { and, lt, notInArray } from 'drizzle-orm';
import db from '../../db/index.js';
import { guestSession } from '../../db/schema.js';
import getSetting from '../settings/getSetting.js';
import { planHook } from '../hooks/triggerHook.js';
import deleteGuest from './deleteGuest.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const BATCH = 200;

/*
  Deletes every guest session unused for longer than `system:guest_idle_days` (default 60), merged or not. 0 keeps
  guests forever. Run daily by the scheduler (middleware/kempo.js registers it).

  Each guest goes in its own transaction (see `deleteGuest`), so one an extension's handler refuses to let go of is
  counted in `failed` and left for the next run, and never holds back the others.
*/
export default async ({ now = new Date(), days } = {}) => {
  try {
    let idleDays = days;

    if(idleDays === undefined){
      const [, stored] = await getSetting('system', 'guest_idle_days', 60);
      idleDays = Number(stored);
      if(!Number.isFinite(idleDays) || idleDays < 0) idleDays = 60;
    }

    if(idleDays === 0) return [null, { deleted: 0, failed: 0 }];

    const cutoff = new Date(now.getTime() - idleDays * DAY_MS);
    const plan = await planHook('guest:expired');
    const failed = [];
    let deleted = 0;

    for(;;){
      const idle = lt(guestSession.lastSeenAt, cutoff);
      const batch = await db.select({ token: guestSession.token }).from(guestSession)
        .where(failed.length ? and(idle, notInArray(guestSession.token, failed)) : idle)
        .limit(BATCH);

      if(!batch.length) break;

      for(const { token } of batch){
        const [error] = await deleteGuest({ token, plan });
        if(!error) deleted++;
        else if(error.code !== 404) failed.push(token);
      }
    }

    return [null, { deleted, failed: failed.length }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to delete idle guest sessions' }, null];
  }
};
