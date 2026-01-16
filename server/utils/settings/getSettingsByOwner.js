import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { like } from 'drizzle-orm';
import { convertValue } from './helpers.js';

export default async (owner) => {
  if(!owner){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }
  
  try {
    const results = await db
      .select()
      .from(setting)
      .where(like(setting.name, `${owner}:%`));
    
    return [null, Object.fromEntries(
      results.map(s => [s.name, convertValue(s.value, s.type)])
    )];
  } catch(error){
    return [{ code: 500, msg: 'Failed to retrieve settings' }, null];
  }
};
