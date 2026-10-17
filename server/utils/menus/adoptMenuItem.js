import { readStores, writeStores, menuHome, isMenuDefinition } from './store.js';
import { parseLink } from './markup.js';
import saveMenu from './saveMenu.js';
import triggerHook from '../hooks/triggerHook.js';

/*
  Moves an existing single link into a menu so it is managed on the Menus page. Only a single link
  qualifies: anything else would lose what it is made of when the page rewrites it.

  Without a `menuId` it goes into the menu already shown in the link's location; if there is none, a
  menu named `menuName` is made and shown there, so the link stays exactly where it was on the site.
*/
export default async ({ rootDir, id, menuId, menuName, extensionDirs }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!id){
    return [{ code: 400, msg: 'Global content ID is required' }, null];
  }

  let stores = await readStores(rootDir);
  const entry = stores.active.find(e => e.id === id && !e.menu);
  if(!entry){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }
  if(entry.owner !== 'custom'){
    return [{ code: 403, msg: 'This belongs to an extension' }, null];
  }
  if(!parseLink(entry.markup)){
    return [{ code: 400, msg: 'Only a single link can be managed as a menu item' }, null];
  }

  let target = menuId
    ? stores.active.find(e => e.id === menuId && isMenuDefinition(e))
    : stores.active.find(e => isMenuDefinition(e) && e.menuLocations.includes(entry.location));
  if(menuId && !target){
    return [{ code: 404, msg: 'Menu not found' }, null];
  }

  if(!target){
    const [error, created] = await saveMenu({ rootDir, name: menuName || entry.location, extensionDirs });
    if(error){
      return [error, null];
    }
    stores = await readStores(rootDir);
    target = stores.active.find(e => e.id === created.id);
    target.menuLocations = [entry.location];
  }

  const live = stores.active.find(e => e.id === id);
  live.menu = target.id;
  live.location = menuHome(target.id);
  live.updatedAt = new Date().toISOString();
  await writeStores(rootDir, stores, extensionDirs);
  await triggerHook('globalContent:updated', { id, updatedAt: live.updatedAt });

  return [null, { id, menuId: target.id }];
};
