import { readStores, writeStores } from './store.js';
import triggerHook from '../hooks/triggerHook.js';

/*
  Deletes a menu and all of its items. Where it was shown is left without a menu.
*/
export default async ({ rootDir, id, extensionDirs }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!id){
    return [{ code: 400, msg: 'Menu ID is required' }, null];
  }

  const stores = await readStores(rootDir);
  if(!stores.active.some(e => e.id === id && e.menuLocations !== null)){
    return [{ code: 404, msg: 'Menu not found' }, null];
  }

  const removed = [...stores.active, ...stores.disabled].filter(e => e.menu === id).map(e => e.id);
  stores.active = stores.active.filter(e => e.menu !== id);
  stores.disabled = stores.disabled.filter(e => e.menu !== id);
  await writeStores(rootDir, stores, extensionDirs);
  for(const removedId of removed) await triggerHook('globalContent:deleted', { id: removedId });

  return [null, { deleted: removed.length - 1 }];
};
