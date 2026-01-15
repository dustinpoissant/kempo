import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (id) => {
  await db.delete(user).where(eq(user.id, id));
  return { id };
};
