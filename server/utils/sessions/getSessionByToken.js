import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (token) => {
  const result = await db.select().from(session).where(eq(session.token, token)).limit(1);
  return result[0] || null;
};
