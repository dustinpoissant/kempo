import db from '../../db/index.js';
import { email } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/* One email of the log, with its whole body. Resolves to [error, email]. */
export default async id => {
  if(!id) return [{ code: 400, msg: 'An email id is required' }, null];
  try {
    const [row] = await db.select().from(email).where(eq(email.id, String(id))).limit(1);
    return row ? [null, row] : [{ code: 404, msg: 'Email not found' }, null];
  } catch {
    return [{ code: 500, msg: 'Failed to read the email' }, null];
  }
};
