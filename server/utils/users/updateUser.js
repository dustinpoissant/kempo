import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (id, updates) => {
  const updatedUser = await db
    .update(user)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(user.id, id))
    .returning();
  
  if(updatedUser.length === 0) return null;
  
  return {
    id: updatedUser[0].id,
    email: updatedUser[0].email,
    name: updatedUser[0].name,
    emailVerified: updatedUser[0].emailVerified,
  };
};
