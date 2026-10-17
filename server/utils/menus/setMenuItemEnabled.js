import { readStores, writeStores, isMenuItem } from './store.js';
import triggerHook from '../hooks/triggerHook.js';

/*
  Hides an item from its menu without deleting it, or shows it again.
*/
export default async ({ rootDir, id, enabled, extensionDirs }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!id || typeof enabled !== 'boolean'){
    return [{ code: 400, msg: 'An item and whether it is enabled are required' }, null];
  }

  const stores = await readStores(rootDir);
  const [from, to] = enabled ? [stores.disabled, stores.active] : [stores.active, stores.disabled];
  const index = from.findIndex(e => e.id === id && isMenuItem(e));
  if(index === -1){
    const already = to.some(e => e.id === id && isMenuItem(e));
    return already ? [null, { id, enabled }] : [{ code: 404, msg: 'Menu item not found' }, null];
  }
  if(from[index].locked){
    return [{ code: 403, msg: 'A locked item cannot be hidden' }, null];
  }

  to.push(...from.splice(index, 1));
  await writeStores(rootDir, stores, extensionDirs);
  await triggerHook('globalContent:updated', { id, updatedAt: new Date().toISOString() });

  return [null, { id, enabled }];
};
