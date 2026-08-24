import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { invalidateScopeCache } from './scopeCache.js';
import { getUnmetDependencies } from './dependencies.js';

export default async ({ name }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
  }

  try {
    const [existing] = await db.select().from(extension).where(eq(extension.name, name)).limit(1);
    if(!existing){
      return [{ code: 404, msg: 'Extension not found' }, null];
    }

    const unmet = await getUnmetDependencies(existing.kempo?.dependencies || []);
    if(unmet.length){
      return [{ code: 409, msg: `Requires ${unmet.join(', ')} to be enabled first` }, null];
    }

    const [updated] = await db.update(extension)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(extension.name, name))
      .returning();

    invalidateScopeCache();
    return [null, updated];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to enable extension' }, null];
  }
};
