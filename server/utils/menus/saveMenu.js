import crypto from 'crypto';
import { readStores, writeStores, menuHome, isMenuDefinition } from './store.js';
import triggerHook from '../hooks/triggerHook.js';

/*
  Creates a menu, or renames one when `id` is given. A new menu is not shown anywhere until it is
  assigned to a location.
*/
export default async ({ rootDir, id, name, author, extensionDirs }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!String(name || '').trim()){
    return [{ code: 400, msg: 'Name is required' }, null];
  }

  const stores = await readStores(rootDir);
  const now = new Date().toISOString();

  if(id){
    const definition = stores.active.find(e => e.id === id && isMenuDefinition(e));
    if(!definition){
      return [{ code: 404, msg: 'Menu not found' }, null];
    }
    definition.name = name.trim();
    definition.updatedAt = now;
    await writeStores(rootDir, stores, extensionDirs);
    await triggerHook('globalContent:updated', { id, updatedAt: now });
    return [null, { id }];
  }

  const menuId = crypto.randomUUID();
  stores.active.push({
    id: menuId,
    name: name.trim(),
    owner: 'custom',
    author: author || '',
    locked: false,
    menu: menuId,
    menuLocations: [],
    menuCopyOf: '',
    navItem: '',
    extra: {},
    location: menuHome(menuId),
    priority: 0,
    createdAt: now,
    updatedAt: now,
    markup: ''
  });
  await writeStores(rootDir, stores, extensionDirs);
  await triggerHook('globalContent:created', { id: menuId, name: name.trim(), location: menuHome(menuId) });

  return [null, { id: menuId }];
};
