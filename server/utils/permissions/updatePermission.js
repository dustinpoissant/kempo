import db from '../../db/index.js';
import { permission } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name, updates) => {
  if(!name){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }

  if(!updates || Object.keys(updates).length === 0){
    return [{ code: 400, msg: 'Updates are required' }, null];
  }

  try {
    const [result] = await db
      .update(permission)
      .set(updates)
      .where(eq(permission.name, name))
      .returning();

    if(!result){
      return [{ code: 404, msg: 'Permission not found' }, null];
    }

    return [null, result];
  } catch(error){
    return [{ code: 500, msg: 'Failed to update permission' }, null];
  }
};
