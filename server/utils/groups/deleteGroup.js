import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name) => {
  const [result] = await db
    .delete(group)
    .where(eq(group.name, name))
    .returning();
  
  return result;
};
