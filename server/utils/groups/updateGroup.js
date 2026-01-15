import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name, updates) => {
  const [result] = await db
    .update(group)
    .set(updates)
    .where(eq(group.name, name))
    .returning();
  
  return result;
};
