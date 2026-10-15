import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { invalidateScopeCache } from './scopeCache.js';
import getEnabledDependentTree from './getDependentTree.js';

/*
  Switches an extension off. Anything enabled that requires it (directly or through another) cannot
  keep running without it, so without `cascade` this refuses and returns that whole tree as
  `dependents` for the caller to show. With `cascade` the extension and everything above it are
  switched off together, in one statement, so there is no half-disabled state to recover from.
  Enabling is never cascaded: each of them is turned back on deliberately.
*/
export default async ({ name, cascade = false }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
  }

  try {
    const [existing] = await db.select({ name: extension.name }).from(extension).where(eq(extension.name, name)).limit(1);
    if(!existing){
      return [{ code: 404, msg: 'Extension not found' }, null];
    }

    const dependents = await getEnabledDependentTree(name);
    if(dependents.length && !cascade){
      return [{
        code: 409,
        msg: `${dependents.map(dependent => dependent.name).join(', ')} depends on this extension and is still enabled`,
        dependents,
      }, null];
    }

    const names = [name, ...dependents.map(dependent => dependent.name)];
    await db.update(extension)
      .set({ enabled: false, updatedAt: new Date() })
      .where(inArray(extension.name, names));

    const [updated] = await db.select().from(extension).where(eq(extension.name, name)).limit(1);

    invalidateScopeCache();
    return [null, { ...updated, disabled: names }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to disable extension' }, null];
  }
};
