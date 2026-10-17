import { readStores, writeStores, isMenuItem } from './store.js';
import triggerHook from '../hooks/triggerHook.js';

/*
  `ids` are a menu's items in the order they should now render. They take over the priorities those
  same items already held, so the priorities stay in the range they were in. Priorities that were
  equal are separated by one each, because equal ones have no order to keep.
*/
export default async ({ rootDir, menuId, ids, extensionDirs }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!menuId || !Array.isArray(ids) || !ids.length){
    return [{ code: 400, msg: 'A menu and the item order are required' }, null];
  }

  const stores = await readStores(rootDir);
  const items = ids.map(id => [...stores.active, ...stores.disabled].find(e => e.id === id && isMenuItem(e) && e.menu === menuId));
  if(items.includes(undefined) || new Set(ids).size !== ids.length){
    return [{ code: 404, msg: 'Menu item not found' }, null];
  }

  const slots = items.map(e => e.priority).sort((a, b) => b - a);
  for(let i = 1; i < slots.length; i++) slots[i] = Math.min(slots[i], slots[i - 1] - 1);

  const now = new Date().toISOString();
  items.forEach((entry, i) => {
    if(entry.priority === slots[i]) return;
    entry.priority = slots[i];
    entry.updatedAt = now;
  });
  await writeStores(rootDir, stores, extensionDirs);
  await triggerHook('globalContent:updated', { id: ids[0], updatedAt: now });

  return [null, { ids }];
};
