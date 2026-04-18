import db from '../../db/index.js';
import { hook } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ id }) => {
  if(!id){
    return [{ code: 400, msg: 'Hook ID is required' }, null];
  }

  try {
    const deleted = await db.delete(hook).where(eq(hook.id, id)).returning();
    if(!deleted.length){
      return [{ code: 404, msg: 'Hook not found' }, null];
    }
    return [null, { success: true }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to delete hook' }, null];
  }
};
