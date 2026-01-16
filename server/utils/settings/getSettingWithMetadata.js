import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { convertValue } from './helpers.js';

export default async (owner, name) => {
  if(!owner || !name){
    return [{ code: 400, msg: 'Both owner and name are required' }, null];
  }
  
  try {
    const fullName = `${owner}:${name}`;
    const [result] = await db
      .select()
      .from(setting)
      .where(eq(setting.name, fullName))
      .limit(1);
    
    if(!result) return [{ code: 404, msg: 'Setting not found' }, null];
    
    return [null, {
      name: result.name,
      value: convertValue(result.value, result.type),
      type: result.type,
      isPublic: result.isPublic,
      description: result.description
    }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve setting' }, null];
  }
};
