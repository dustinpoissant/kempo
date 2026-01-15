import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (userId) => {
  await db.delete(session).where(eq(session.userId, userId));
  return { userId };
};
