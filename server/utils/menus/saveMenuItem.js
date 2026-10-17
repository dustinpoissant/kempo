import crypto from 'crypto';
import { buildLink } from './markup.js';
import { readStores, writeStores, menuHome, isMenuItem, isMenuDefinition } from './store.js';
import findMenuLocations from './findMenuLocations.js';
import findNavItems from './findNavItems.js';
import triggerHook from '../hooks/triggerHook.js';

/*
  Adds an item to a menu, or changes one when `id` is given. A new item goes to the end of the menu: its
  priority is one below the lowest in that menu (items render highest first).

  An item is a link (`label`, `href`, ...) or one an extension supplies, named by `navItem`
  (`<extension>:<id>`, from findNavItems), which takes its label and markup from the extension.

  A new item can name the `menuId` to join, or just the `location` it should show in. For a location,
  it joins the menu shown there; when there is none, one is made, named after the location, and shown
  there. That is what lets an item be added to "Main menu" without making a menu first.
*/
export default async ({ rootDir, id, menuId, location, navItem, label, href, icon, newTab, author, extensionDirs }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  let name;
  let markup;
  if(navItem){
    const supplied = (await findNavItems({ extensionDirs }))[1].find(item => item.key === navItem);
    if(!supplied){
      return [{ code: 404, msg: 'That item is not available. Its extension may be disabled or removed.' }, null];
    }
    name = supplied.label;
    markup = supplied.markup;
  } else {
    const [linkError, linkMarkup] = buildLink({ label, href, icon, newTab });
    if(linkError){
      return [linkError, null];
    }
    name = label.trim();
    markup = linkMarkup;
  }

  const stores = await readStores(rootDir);
  const now = new Date().toISOString();

  if(id){
    const entry = [...stores.active, ...stores.disabled].find(e => e.id === id && isMenuItem(e));
    if(!entry){
      return [{ code: 404, msg: 'Menu item not found' }, null];
    }
    if(entry.navItem){
      return [{ code: 400, msg: 'An item from an extension cannot be edited. Delete it and add it again to change it.' }, null];
    }
    if(entry.locked){
      return [{ code: 403, msg: 'This item is locked and cannot be edited' }, null];
    }
    entry.name = name;
    entry.markup = markup;
    entry.updatedAt = now;
    await writeStores(rootDir, stores, extensionDirs);
    await triggerHook('globalContent:updated', { id, updatedAt: now });
    return [null, { id, updatedAt: now }];
  }

  let target = menuId
    ? stores.active.find(e => e.id === menuId && isMenuDefinition(e))
    : stores.active.find(e => isMenuDefinition(e) && e.menuLocations.includes(location));

  if(!target && !menuId && location){
    const [, declared] = await findMenuLocations({ rootDir });
    const place = declared.find(l => l.location === location);
    if(!place){
      return [{ code: 400, msg: 'That place is not a menu in the theme' }, null];
    }
    const newId = crypto.randomUUID();
    target = {
      id: newId,
      name: place.label,
      owner: 'custom',
      author: author || '',
      locked: false,
      menu: newId,
      menuLocations: [location],
      menuCopyOf: '',
      navItem: '',
      extra: {},
      location: menuHome(newId),
      priority: 0,
      createdAt: now,
      updatedAt: now,
      markup: ''
    };
    stores.active.push(target);
  }

  if(!target){
    return [{ code: 404, msg: 'Menu not found' }, null];
  }

  const siblings = [...stores.active, ...stores.disabled].filter(e => isMenuItem(e) && e.menu === target.id);
  const entry = {
    id: crypto.randomUUID(),
    name,
    owner: 'custom',
    author: author || '',
    locked: false,
    menu: target.id,
    menuLocations: null,
    menuCopyOf: '',
    navItem: navItem || '',
    extra: {},
    location: menuHome(target.id),
    priority: siblings.length ? Math.min(...siblings.map(e => e.priority)) - 1 : 100,
    createdAt: now,
    updatedAt: now,
    markup
  };
  stores.active.push(entry);
  await writeStores(rootDir, stores, extensionDirs);
  await triggerHook('globalContent:created', { id: entry.id, name: entry.name, location: entry.location });

  return [null, { id: entry.id, menuId: target.id, priority: entry.priority }];
};
