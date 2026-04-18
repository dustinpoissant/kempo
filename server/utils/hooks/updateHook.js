import db from '../../db/index.js';
import { hook } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ id, callback }) => {
  if(!id){
    return [{ code: 400, msg: 'Hook ID is required' }, null];
  }
  if(!callback){
    return [{ code: 400, msg: 'Callback is required' }, null];
  }

  try {
    const updated = await db.update(hook)
      .set({ callback })
      .where(eq(hook.id, id))
      .returning();

    if(!updated.length){
      return [{ code: 404, msg: 'Hook not found' }, null];
    }

    return [null, updated[0]];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to update hook' }, null];
  }
};
