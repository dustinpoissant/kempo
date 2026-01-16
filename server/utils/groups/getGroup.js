import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name) => {
  if(!name){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }
  
  try {
    const [result] = await db
      .select()
      .from(group)
      .where(eq(group.name, name))
      .limit(1);
    
    if(!result){
      return [{ code: 404, msg: 'Group not found' }, null];
    }
    
    return [null, result];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve group' }, null];
  }
};
