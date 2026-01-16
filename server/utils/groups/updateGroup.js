import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name, updates) => {
  if(!name){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }
  
  if(!updates || Object.keys(updates).length === 0){
    return [{ code: 400, msg: 'Updates are required' }, null];
  }
  
  try {
    const [result] = await db
      .update(group)
      .set(updates)
      .where(eq(group.name, name))
      .returning();
    
    if(!result){
      return [{ code: 404, msg: 'Group not found' }, null];
    }
    
    return [null, result];
  } catch(error){
    if(error.code === '23505'){
      return [{ code: 409, msg: 'Group name already exists' }, null];
    }
    return [{ code: 500, msg: 'Failed to update group' }, null];
  }
};
