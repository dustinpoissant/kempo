import db from '../../db/index.js';
import { email } from '../../db/schema.js';
import { and, lt, eq, notInArray } from 'drizzle-orm';
import emailSettings from './emailSettings.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/*
  Deletes the emails that are older than the settings keep them. A kind of email in `email_retention_by_type` is kept that many days,
  every other kind `email_retention_days`; 0 keeps it forever. Resolves to [error, { deleted }].
*/
export default async ({ now = new Date() } = {}) => {
  try {
    const { retentionDays, retentionByType } = await emailSettings();
    const specific = Object.keys(retentionByType);
    let deleted = 0;
    for(const [type, days] of Object.entries(retentionByType)){
      if(days === 0) continue;
      deleted += (await db.delete(email).where(and(eq(email.type, type), lt(email.createdAt, new Date(now.getTime() - days * DAY_MS)))).returning({ id: email.id })).length;
    }
    if(retentionDays > 0){
      const older = lt(email.createdAt, new Date(now.getTime() - retentionDays * DAY_MS));
      deleted += (await db.delete(email).where(specific.length ? and(notInArray(email.type, specific), older) : older).returning({ id: email.id })).length;
    }
    return [null, { deleted }];
  } catch {
    return [{ code: 500, msg: 'Failed to delete old emails' }, null];
  }
};
