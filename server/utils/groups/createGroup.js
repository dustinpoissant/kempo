import db from '../../db/index.js';
import { group } from '../../db/schema.js';

export default async ({ name, description, owner = 'user' }) => {
  const [result] = await db
    .insert(group)
    .values({
      name,
      description,
      owner,
      createdAt: new Date()
    })
    .returning();
  
  return result;
};
