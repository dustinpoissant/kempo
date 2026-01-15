import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name) => {
  const [result] = await db
    .select()
    .from(group)
    .where(eq(group.name, name))
    .limit(1);
  
  return result || null;
};
