import { readStores, writeStores, isMenuDefinition } from './store.js';
import findMenuLocations from './findMenuLocations.js';
import triggerHook from '../hooks/triggerHook.js';

/*
  Chooses the menu shown in a location, or none when `menuId` is empty. A location shows one menu, so
  choosing one takes the location from whichever menu had it; a menu can be chosen for several.
  Only a place the theme marks as a menu can be newly assigned, so a typo cannot silently show nothing.
*/
export default async ({ rootDir, location, menuId, extensionDirs }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!location){
    return [{ code: 400, msg: 'Location is required' }, null];
  }

  const stores = await readStores(rootDir);
  const definitions = stores.active.filter(isMenuDefinition);
  const target = menuId ? definitions.find(d => d.id === menuId) : null;
  if(menuId && !target){
    return [{ code: 404, msg: 'Menu not found' }, null];
  }

  if(target){
    const [, declared] = await findMenuLocations({ rootDir });
    if(!target.menuLocations.includes(location) && !declared.some(l => l.location === location)){
      return [{ code: 400, msg: 'That place is not a menu in the theme' }, null];
    }
  }

  const now = new Date().toISOString();
  for(const definition of definitions){
    if(!definition.menuLocations.includes(location)) continue;
    definition.menuLocations = definition.menuLocations.filter(l => l !== location);
    definition.updatedAt = now;
  }
  if(target){
    target.menuLocations = [...target.menuLocations, location];
    target.updatedAt = now;
  }

  await writeStores(rootDir, stores, extensionDirs);
  await triggerHook('globalContent:updated', { id: target?.id ?? '', updatedAt: now });

  return [null, { location, menuId: target?.id ?? null }];
};
