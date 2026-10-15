import db from '../../db/index.js';
import { extension } from '../../db/schema.js';

let cache = null;

export const invalidateScopeCache = () => { cache = null; };

/* One read of the extension table serves both questions, until an install/enable/disable/uninstall. */
const load = async () => {
  if(cache) return cache;
  try {
    const rows = await db.select().from(extension);
    cache = {
      enabled: rows.filter(row => row.enabled),
      disabled: new Set(rows.filter(row => !row.enabled).map(row => row.name)),
    };
  } catch(e) {
    console.error('[scopeCache] DB error fetching extensions:', e.message);
    return { enabled: [], disabled: new Set() };
  }
  return cache;
};

export const getEnabledExtensions = async () => (await load()).enabled;

/* Names of extensions that are installed but switched off. Not-installed owners (core, a site) are never in it. */
export const getDisabledExtensionNames = async () => (await load()).disabled;
