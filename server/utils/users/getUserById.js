import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (id) => {
  if(!id){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  try {
    const result = await db.select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    }).from(user).where(eq(user.id, id)).limit(1);
    
    if(!result[0]){
      return [{ code: 404, msg: 'User not found' }, null];
    }
    
    return [null, result[0]];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve user' }, null];
  }
};
