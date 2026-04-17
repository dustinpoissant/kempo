import db from '../../db/index.js';
import { permission } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async (name) => {
  if(!name){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }

  const owner = name.includes(':') ? name.split(':')[0] : null;
  if(owner && owner !== 'admin'){
    return [{ code: 403, msg: `Cannot delete ${owner}-owned permissions` }, null];
  }

  try {
    const [result] = await db
      .delete(permission)
      .where(eq(permission.name, name))
      .returning();

    if(!result){
      return [{ code: 404, msg: 'Permission not found' }, null];
    }

    return [null, result];
  } catch(error){
    return [{ code: 500, msg: 'Failed to delete permission' }, null];
  }
};
