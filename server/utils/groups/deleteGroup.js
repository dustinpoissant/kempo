import db from '../../db/index.js';
import { group } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name) => {
  if(!name){
    return [{ code: 400, msg: 'Group name is required' }, null];
  }

  const owner = name.includes(':') ? name.split(':')[0] : null;
  if(owner && owner !== 'admin'){
    return [{ code: 403, msg: `Cannot delete ${owner}-owned groups` }, null];
  }

  try {
    const [result] = await db
      .delete(group)
      .where(eq(group.name, name))
      .returning();
    
    if(!result){
      return [{ code: 404, msg: 'Group not found' }, null];
    }
    
    return [null, result];
  } catch(error){
    return [{ code: 500, msg: 'Failed to delete group' }, null];
  }
};
