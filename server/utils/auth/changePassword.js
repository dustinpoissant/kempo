import bcrypt from 'bcrypt';
import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ userId, newPassword }) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(!newPassword){
    return [{ code: 400, msg: 'New password is required' }, null];
  }
  
  try {
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    await db
      .update(user)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(user.id, userId));
    
    return [null, { success: true }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to change password' }, null];
  }
};
