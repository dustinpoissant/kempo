import db from '../../db/index.js';
import { email } from '../../db/schema.js';
import { and, eq, inArray } from 'drizzle-orm';
import dispatchEmail from './dispatchEmail.js';

/*
  Tries an email that did not go again, as if it were new: it gets the full number of tries once more. Only a `queued` or `failed`
  email can be tried again (one that is `sent` or being sent is left alone). Resolves like sendEmail.
*/
export default async id => {
  try {
    const [row] = await db.update(email)
      .set({ status: 'queued', attempts: 0, lastError: null, updatedAt: new Date() })
      .where(and(eq(email.id, String(id ?? '')), inArray(email.status, ['queued', 'failed'])))
      .returning({ id: email.id });
    if(!row) return [{ code: 409, msg: 'Only an email that is waiting or failed can be tried again' }, null];
  } catch {
    return [{ code: 500, msg: 'Failed to retry the email' }, null];
  }
  return dispatchEmail(String(id));
};
