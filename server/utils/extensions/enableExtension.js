import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { invalidateScopeCache } from './scopeCache.js';

export default async ({ name }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
  }

  try {
    const updated = await db.update(extension)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(extension.name, name))
      .returning();

    if(!updated.length){
      return [{ code: 404, msg: 'Extension not found' }, null];
    }

    invalidateScopeCache();
    return [null, updated[0]];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to enable extension' }, null];
  }
};
