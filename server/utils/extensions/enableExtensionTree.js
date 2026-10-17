import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { invalidateScopeCache } from './scopeCache.js';
import getRequirementTree from './getRequirementTree.js';
import checkClaims from './checkClaims.js';

/*
  Switches an extension on. It cannot run without what it requires, so any of that which is installed
  but off has to be enabled too: without `cascade` this refuses and returns that whole chain as
  `requirements` for the caller to show, and with `cascade` they are enabled together with it, in one
  statement. A requirement that is not installed at all cannot be fixed by enabling, and is refused
  by name either way.

  It only ever turns on what the extension needs. Whatever else was switched off along with it, for
  its own reasons, stays off.
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

    const { disabled, missing } = await getRequirementTree(name);

    if(missing.length){
      return [{ code: 409, msg: `Requires ${missing.join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} not installed`, missing }, null];
    }

    if(disabled.length && !cascade){
      return [{
        code: 409,
        msg: `Requires ${disabled.map(requirement => requirement.name).join(', ')} to be enabled first`,
        requirements: disabled,
      }, null];
    }

    const names = [name, ...disabled.map(requirement => requirement.name)];

    /* Switching on what claims an address another enabled extension already has would silently break one of them. */
    const [claimsError] = await checkClaims({ names, verb: 'enable' });
    if(claimsError){
      return [claimsError, null];
    }

    await db.update(extension)
      .set({ enabled: true, updatedAt: new Date() })
      .where(inArray(extension.name, names));

    const [updated] = await db.select().from(extension).where(eq(extension.name, name)).limit(1);

    invalidateScopeCache();
    return [null, { ...updated, enabled: true, enabledNames: names }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to enable extension' }, null];
  }
};
