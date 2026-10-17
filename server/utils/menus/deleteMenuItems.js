import { readStores, writeStores, isMenuItem } from './store.js';
import triggerHook from '../hooks/triggerHook.js';

export default async ({ rootDir, ids, extensionDirs }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!Array.isArray(ids) || !ids.length){
    return [{ code: 400, msg: 'No IDs specified' }, null];
  }

  const stores = await readStores(rootDir);
  const found = [...stores.active, ...stores.disabled].filter(e => ids.includes(e.id) && isMenuItem(e));
  if(found.length !== new Set(ids).size){
    return [{ code: 404, msg: 'Menu item not found' }, null];
  }
  if(found.some(e => e.locked)){
    return [{ code: 403, msg: 'A locked item cannot be deleted' }, null];
  }

  stores.active = stores.active.filter(e => !ids.includes(e.id));
  stores.disabled = stores.disabled.filter(e => !ids.includes(e.id));
  await writeStores(rootDir, stores, extensionDirs);
  for(const id of ids) await triggerHook('globalContent:deleted', { id });

  return [null, { deleted: ids.length }];
};
