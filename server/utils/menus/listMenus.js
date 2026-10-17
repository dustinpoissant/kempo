import { readFile } from 'fs/promises';
import { basename, dirname } from 'path';
import scanDir from '../fs/scanDir.js';
import { parseEntries } from '../global-content/helpers.js';
import findMenuLocations from './findMenuLocations.js';
import findNavItems from './findNavItems.js';
import findPages from './findPages.js';
import { readStores, isMenuDefinition, isMenuItem } from './store.js';
import { parseLink } from './markup.js';

/*
  What an extension adds to a location from its own public/*.global.html. It is shown so the person
  editing the menus sees the whole of what a location will contain, but it cannot be changed here:
  it belongs to the extension.
*/
const readExtensionEntries = async dirs => {
  const found = [];
  for(const dir of dirs){
    const owner = basename(dirname(dir));
    const files = await scanDir(dir, dir, async (fullPath, entry) =>
      !entry.isDirectory() && entry.name.endsWith('.global.html') ? fullPath : null);
    for(const file of files){
      for(const entry of parseEntries(await readFile(file, 'utf-8'))) found.push({ ...entry, owner });
    }
  }
  return found;
};

const toItem = (entry, disabled, available = new Map()) => {
  const link = entry.navItem ? null : parseLink(entry.markup);
  return {
    id: entry.id,
    label: link?.label ?? entry.name,
    href: link?.href ?? '',
    icon: link?.icon ?? '',
    newTab: link?.newTab ?? false,
    editable: link !== null,
    navItem: entry.navItem,
    available: entry.navItem ? available.has(entry.navItem) : true,
    priority: entry.priority,
    owner: entry.owner,
    disabled
  };
};

/*
  The site's menus and the places in its theme that can show one.

  A menu is `{ id, name, locations, items }`, its items in the order they render (highest priority
  first). A location is `{ location, label, declared, menuId, extensionItems, candidates }`:
  `menuId` is the menu shown there (or null), `extensionItems` what extensions put there themselves,
  and `candidates` the plain links already placed there, which can be moved into a menu but are never
  converted on their own. `declared` is false for a place the theme no longer has.

  `pages` is every page a link can go to, the site's and those its extensions serve under their scopes
  (see findPages.js), as { url, title, owner }.

  `extensionDirs` overrides where extensions' content is read from, and `extensions` where their pages are.
*/
export default async ({ rootDir, extensionDirs, extensions }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const [, declared] = await findMenuLocations({ rootDir });
  const { active, disabled } = await readStores(rootDir);
  const dirs = extensionDirs ?? await (await import('../extensions/contentDirs.js')).extensionPublicDirs();
  const fromExtensions = await readExtensionEntries(dirs);
  const navItems = (await findNavItems({ extensionDirs: dirs }))[1];
  const available = new Map(navItems.map(item => [item.key, item]));

  const menus = active.filter(isMenuDefinition).map(definition => ({
    id: definition.id,
    name: definition.name,
    locations: definition.menuLocations,
    items: [
      ...active.filter(e => isMenuItem(e) && e.menu === definition.id).map(e => toItem(e, false, available)),
      ...disabled.filter(e => isMenuItem(e) && e.menu === definition.id).map(e => toItem(e, true, available))
    ].sort((a, b) => b.priority - a.priority)
  }));

  const locations = declared.map(({ location, label }) => ({ location, label, declared: true }));
  for(const menu of menus){
    for(const location of menu.locations){
      if(!locations.some(l => l.location === location)) locations.push({ location, label: location, declared: false });
    }
  }

  for(const place of locations){
    place.menuId = menus.find(m => m.locations.includes(place.location))?.id ?? null;
    place.extensionItems = [
      ...active.filter(e => !e.menu && e.owner !== 'custom' && e.location === place.location),
      ...fromExtensions.filter(e => e.location === place.location)
    ].map(e => toItem(e, false)).sort((a, b) => b.priority - a.priority);
    place.candidates = active
      .filter(e => !e.menu && e.owner === 'custom' && e.location === place.location && parseLink(e.markup))
      .map(e => toItem(e, false));
  }

  const [, pages] = await findPages({ rootDir, extensions });

  return [null, { menus, locations, navItems: navItems.map(({ markup, ...item }) => item), pages: pages ?? [] }];
};
