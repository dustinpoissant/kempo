import db from '../../db/index.js';
import { group } from '../../db/schema.js';

export default async ({ name, description, owner = 'user' }) => {
  if(!name){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }
  
  try {
    const [result] = await db
      .insert(group)
      .values({
        name,
        description,
        owner,
        createdAt: new Date()
      })
      .returning();
    
    return [null, result];
  } catch(error){
    if(error.code === '23505'){
      return [{ code: 409, msg: 'Group name already exists' }, null];
    }
    return [{ code: 500, msg: 'Failed to create group' }, null];
  }
};
