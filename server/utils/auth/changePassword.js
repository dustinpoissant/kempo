import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ userId, newPassword }) => {
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  
  await db
    .update(user)
    .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
    .where(eq(user.id, userId));
  
  return { success: true };
};
