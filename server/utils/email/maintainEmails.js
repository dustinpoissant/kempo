import db from '../../db/index.js';
import { email } from '../../db/schema.js';
import { and, asc, eq, lt, or, gt, sql } from 'drizzle-orm';
import dispatchEmail from './dispatchEmail.js';
import emailSettings from './emailSettings.js';
import pruneEmails from './pruneEmails.js';

const MINUTE_MS = 60 * 1000;
const STUCK_MS = 5 * MINUTE_MS;
const BACKOFF_MS = MINUTE_MS;
const TOO_OLD_MS = 24 * 60 * MINUTE_MS;
const BATCH = 50;

/*
  The email job, run every minute by the scheduler (kempo registers it itself):

    - a `sending` email that has not finished in five minutes (the process died) goes back to `queued`;
    - a `queued` email with tries left is sent again, a minute after its last try at the earliest, up to 50 at a time;
    - a `queued` email older than a day is marked `failed` instead, so a password-reset link is never sent a day late;
    - emails older than the retention settings are deleted.
*/
export default async () => {
  const now = Date.now();
  const { maxRetries } = await emailSettings();

  await db.update(email)
    .set({ status: 'queued', lastError: 'The send did not finish' })
    .where(and(eq(email.status, 'sending'), lt(email.updatedAt, new Date(now - STUCK_MS))));

  await db.update(email)
    .set({ status: 'failed', lastError: sql`coalesce(${email.lastError}, 'Never sent') || ' (too old to send now)'`, updatedAt: new Date() })
    .where(and(eq(email.status, 'queued'), lt(email.createdAt, new Date(now - TOO_OLD_MS))));

  const due = await db.select({ id: email.id }).from(email)
    .where(and(
      eq(email.status, 'queued'),
      gt(email.createdAt, new Date(now - TOO_OLD_MS)),
      lt(email.attempts, 1 + maxRetries),
      or(eq(email.attempts, 0), lt(email.updatedAt, new Date(now - BACKOFF_MS))),
    ))
    .orderBy(asc(email.createdAt))
    .limit(BATCH);
  for(const { id } of due) await dispatchEmail(id);

  await pruneEmails();
};
