import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (owner, name) => {
  if(!owner || !name){
    return [{ code: 400, msg: 'Both owner and name are required' }, null];
  }
  
  if(owner === 'system'){
    return [{ code: 403, msg: 'Cannot delete system settings' }, null];
  }
  
  try {
    const fullName = `${owner}:${name}`;
    await db
      .delete(setting)
      .where(eq(setting.name, fullName));
    
    return [null, { deleted: true, name: fullName }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to delete setting' }, null];
  }
};
