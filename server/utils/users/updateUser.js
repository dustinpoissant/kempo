import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (id, updates) => {
  if(!id){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(!updates || Object.keys(updates).length === 0){
    return [{ code: 400, msg: 'Updates are required' }, null];
  }
  
  try {
    const updatedUser = await db
      .update(user)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning();
    
    if(updatedUser.length === 0){
      return [{ code: 404, msg: 'User not found' }, null];
    }
    
    return [null, {
      id: updatedUser[0].id,
      email: updatedUser[0].email,
      name: updatedUser[0].name,
      emailVerified: updatedUser[0].emailVerified,
    }];
  } catch(error){
    if(error.code === '23505'){
      return [{ code: 409, msg: 'Email already in use' }, null];
    }
    return [{ code: 500, msg: 'Failed to update user' }, null];
  }
};
