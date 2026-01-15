import db from '../../db/index.js';
import { session } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (token) => {
  await db.delete(session).where(eq(session.token, token));
  return { token };
};
