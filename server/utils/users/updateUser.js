import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { notifyEmailChanged } from '../notifications/accountNotices.js';

export default async (id, updates) => {
  if(!id){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(!updates || Object.keys(updates).length === 0){
    return [{ code: 400, msg: 'Updates are required' }, null];
  }
  
  try {
    const [before] = updates.email === undefined ? [] : await db.select({ email: user.email }).from(user).where(eq(user.id, id)).limit(1);

    const updatedUser = await db
      .update(user)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning();
    
    if(updatedUser.length === 0){
      return [{ code: 404, msg: 'User not found' }, null];
    }
    
    const result = {
      id: updatedUser[0].id,
      email: updatedUser[0].email,
      name: updatedUser[0].name,
      emailVerified: updatedUser[0].emailVerified,
    };

    if(before && before.email !== result.email){
      await notifyEmailChanged({ userId: id, oldEmail: before.email, newEmail: result.email });
    }

    return [null, result];
  } catch(error){
    if((error.cause?.code ?? error.code) === '23505'){
      return [{ code: 409, msg: 'Email already in use' }, null];
    }
    return [{ code: 500, msg: 'Failed to update user' }, null];
  }
};
