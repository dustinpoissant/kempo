import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { serializeValue } from './helpers.js';

export default async (owner, name, value, type = null, isPublic = false, description = null) => {
  if(!owner || !name){
    return [{ code: 400, msg: 'Both owner and name are required' }, null];
  }
  
  try {
    const fullName = `${owner}:${name}`;
    const detectedType = type || (typeof value === 'object' ? 'json' : typeof value);
    const serializedValue = serializeValue(value, detectedType);
    
    const existing = await db
      .select()
      .from(setting)
      .where(eq(setting.name, fullName))
      .limit(1);
    
    if(existing.length > 0){
      await db
        .update(setting)
        .set({ 
          value: serializedValue,
          type: detectedType,
          isPublic,
          description,
          updatedAt: new Date() 
        })
        .where(eq(setting.name, fullName));
    } else {
      await db.insert(setting).values({
        name: fullName,
        value: serializedValue,
        type: detectedType,
        isPublic,
        description,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return [null, { name: fullName, value, type: detectedType, isPublic, description }];
  } catch(error){
    return [{ code: 500, msg: 'Failed to save setting' }, null];
  }
};
