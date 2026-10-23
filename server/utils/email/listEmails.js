import db from '../../db/index.js';
import { email } from '../../db/schema.js';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

const STATUSES = ['queued', 'sending', 'sent', 'failed'];

/*
  The log, newest first, without the bodies (read one with getEmail). `status`, `type` and `search` (a part of the recipient or the
  subject) narrow it. Resolves to [error, { emails, total, limit, offset }].
*/
export default async ({ status, type, search, limit = 50, offset = 0 } = {}) => {
  try {
    const conditions = [];
    if(status){
      if(!STATUSES.includes(status)) return [{ code: 400, msg: `Status must be one of ${STATUSES.join(', ')}` }, null];
      conditions.push(eq(email.status, status));
    }
    if(type) conditions.push(eq(email.type, String(type)));
    if(search){
      const like = `%${String(search).replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(or(ilike(email.recipient, like), ilike(email.subject, like)));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = Math.max(Number(offset) || 0, 0);
    const emails = await db.select({
      id: email.id, type: email.type, recipient: email.recipient, sender: email.sender, subject: email.subject, status: email.status, attempts: email.attempts,
      lastError: email.lastError, provider: email.provider, createdAt: email.createdAt, updatedAt: email.updatedAt, sentAt: email.sentAt,
    }).from(email).where(where).orderBy(desc(email.createdAt)).limit(take).offset(skip);
    const [{ total }] = await db.select({ total: sql`count(*)::int` }).from(email).where(where);
    return [null, { emails, total, limit: take, offset: skip }];
  } catch {
    return [{ code: 500, msg: 'Failed to read the email log' }, null];
  }
};
