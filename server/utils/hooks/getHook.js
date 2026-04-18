import db from '../../db/index.js';
import { hook } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ id }) => {
  if(!id){
    return [{ code: 400, msg: 'Hook ID is required' }, null];
  }

  try {
    const results = await db.select().from(hook).where(eq(hook.id, id)).limit(1);
    if(!results.length){
      return [{ code: 404, msg: 'Hook not found' }, null];
    }
    return [null, results[0]];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to get hook' }, null];
  }
};
