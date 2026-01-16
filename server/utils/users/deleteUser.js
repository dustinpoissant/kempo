import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (id) => {
  if(!id){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  try {
    await db.delete(user).where(eq(user.id, id));
    return [null, { id }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to delete user' }, null];
  }
};
