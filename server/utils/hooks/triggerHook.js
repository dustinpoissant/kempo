import db from '../../db/index.js';
import { hook } from '../../db/schema.js';
import { eq, asc } from 'drizzle-orm';
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

/*
  Fires every handler registered for `event`, in registration order, awaiting each in turn.

  Two contracts share this one implementation:

  - **Guard** (`bail: true`) — a handler throwing aborts the whole chain and the error propagates to
    the caller, which is how `middleware:before_page` lets an extension veto a page render.
  - **Notification** (the default) — every handler runs regardless of what the others did, and a
    handler that throws is recorded in `results` rather than stopping anything.

  The notification contract is also what a *collaborative* hook is built on: `data` is passed to
  each handler by reference, so an event whose payload carries a mutable draft (see
  `app-public/CATCH.js` and its `route:unmatched` draft response) lets each handler inspect what
  earlier ones decided and add to it, without any handler being able to end the chain early or
  write a response mid-flight. That needs no special mode here — only that ordering be predictable,
  hence the explicit `orderBy` below, since without it row order is whatever the database returns.

  Note that "notification" governs error handling, not timing: handlers are still awaited in
  sequence, so a handler doing slow work holds up whatever triggered the event. Such a handler
  should start its work and return rather than awaiting it here.
*/
export default async (event, data = {}, { bail = false } = {}) => {
  if(!event){
    return [{ code: 400, msg: 'Event is required' }, null];
  }

  try {
    const hooks = await db.select().from(hook)
      .where(eq(hook.event, event))
      .orderBy(asc(hook.createdAt), asc(hook.id));
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
        } catch(err) {
          /*
            Never fail silently: a hook that cannot load is indistinguishable from one that
            allowed the request. For bailing events (guards) that would fail open, so rethrow.
          */
          console.error(`[kempo] Hook handler failed to load for "${event}" (${h.owner}): ${err.message}`);
          if(bail) throw err;
          results.push({ hookId: h.id, owner: h.owner, error: err.message });
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
