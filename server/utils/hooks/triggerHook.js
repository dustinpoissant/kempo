import db from '../../db/index.js';
import { hook } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createRequire } from 'module';
import { dirname, join } from 'path';

const handlerCache = new Map();

export const clearHandlerCache = () => handlerCache.clear();

const requireFromProject = createRequire(join(process.cwd(), 'package.json'));

const resolveHandler = (owner, callback) => {
  if(callback.startsWith('./') || callback.startsWith('../')){
    try {
      const pkgPath = requireFromProject.resolve(`${owner}/package.json`);
      return join(dirname(pkgPath), callback);
    } catch {
      return null;
    }
  }
  return callback;
};

export default async (event, data = {}) => {
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
          const mod = await import(handlerPath);
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
        results.push({ hookId: h.id, owner: h.owner, error: err.message });
      }
    }

    return [null, { results }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to trigger hooks' }, null];
  }
};
