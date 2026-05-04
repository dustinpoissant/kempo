import db from '../../db/index.js';
import { hook } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { join } from 'path';
import { pathToFileURL } from 'url';

const handlerCache = new Map();

export const clearHandlerCache = () => handlerCache.clear();

const resolveHandler = (owner, callback) => {
  if(callback.startsWith('./') || callback.startsWith('../')){
    return join(process.cwd(), 'node_modules', owner, callback);
  }
  return callback;
};

export default async (event, data = {}, { bail = false } = {}) => {
  if(!event){
    return [{ code: 400, msg: 'Event is required' }, null];
  }

  try {
    const hooks = await db.select().from(hook).where(eq(hook.event, event));
    const results = [];

    for(const h of hooks){
      const handlerPath = resolveHandler(h.owner, h.callback);
      if(!handlerPath) continue;

      let handler = handlerCache.get(handlerPath);
      if(!handler){
        try {
          const mod = await import(pathToFileURL(handlerPath).href);
          handler = mod.default || mod;
          handlerCache.set(handlerPath, handler);
        } catch {
          continue;
        }
      }

      try {
        const result = await handler(data);
        results.push({ hookId: h.id, owner: h.owner, result });
      } catch(err) {
        if(bail) throw err;
        results.push({ hookId: h.id, owner: h.owner, error: err.message });
      }
    }

    return [null, { results }];
  } catch(error) {
    if(bail) throw error;
    return [{ code: 500, msg: 'Failed to trigger hooks' }, null];
  }
};
