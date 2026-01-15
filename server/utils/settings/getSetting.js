import db from '../../db/index.js';
import { setting } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name, defaultValue = null) => {
  const result = await db
    .select()
    .from(setting)
    .where(eq(setting.name, name))
    .limit(1);
  
  if(result.length === 0) return defaultValue;
  
  return result[0].value;
};
