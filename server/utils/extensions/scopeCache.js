import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

let cache = null;

export const invalidateScopeCache = () => { cache = null; };

export const getEnabledExtensions = async () => {
  if(cache) return cache;
  try {
    cache = await db.select().from(extension).where(eq(extension.enabled, true));
  } catch(e) {
    console.error('[scopeCache] DB error fetching enabled extensions:', e.message);
    return [];
  }
  return cache;
};
