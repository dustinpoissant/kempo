import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { GLOBAL_FILE, GLOBAL_DISABLED_FILE, parseEntries, serializeEntries } from '../global-content/helpers.js';
import findNavItems from './findNavItems.js';

const read = async path => existsSync(path) ? parseEntries(await readFile(path, 'utf-8')) : [];

const write = async (path, entries) => {
  if(!entries.length && !existsSync(path)) return;
  await writeFile(path, entries.length ? serializeEntries(entries) + '\n' : '', 'utf-8');
};

/*
  Where a menu's own entries are filed. It is not a place any template has, so nothing is rendered
  from them directly: what shows up on the site is the copies below.
*/
export const menuHome = menuId => `menu:${menuId}`;

export const isMenuDefinition = entry => entry.menuLocations !== null;

export const isMenuItem = entry => Boolean(entry.menu) && entry.menuLocations === null && !entry.menuCopyOf;

/*
  The page shows a menu in as many places as it is assigned, but a piece of global content fills one
  location. So each enabled item gets a copy in every location its menu is assigned to, and the copies
  are what a template renders. They are rebuilt from the items on every write, never edited, which is
  what keeps a menu's places in step with its items.

  An item an extension supplies keeps the extension's markup as it was when last written, so it renders
  even though kempo-server cannot look it up at render time. `navItems` (name to item) is how it is kept
  current: the markup is refreshed from the extension, and the item gets no copies, so it disappears from
  the site, while the extension is not available. The item itself stays in its menu, so it returns with
  the extension.
*/
const rebuildCopies = (active, navItems) => {
  const entries = active.filter(e => !e.menuCopyOf);
  const copies = [];

  for(const entry of entries.filter(e => e.navItem && navItems?.has(e.navItem))){
    const current = navItems.get(entry.navItem);
    entry.name = current.label;
    entry.markup = current.markup;
  }

  for(const definition of entries.filter(isMenuDefinition)){
    const items = entries.filter(e => isMenuItem(e) && e.menu === definition.id && !(e.navItem && navItems && !navItems.has(e.navItem)));
    for(const location of definition.menuLocations){
      for(const item of items){
        copies.push({
          ...item,
          id: `${item.id}@${location}`,
          locked: false,
          location,
          menuCopyOf: item.id,
          navItem: '',
          extra: {}
        });
      }
    }
  }
  return [...entries, ...copies];
};

/*
  Both files a site's global content lives in: what is showing, and what has been switched off.
  An item can be in either, so menu operations always look at both. The copies are left out of
  `active`, as they only exist to be rendered.
*/
export const readStores = async rootDir => ({
  active: (await read(join(rootDir, GLOBAL_FILE))).filter(e => !e.menuCopyOf),
  disabled: await read(join(rootDir, GLOBAL_DISABLED_FILE))
});

export const writeStores = async (rootDir, { active, disabled }, extensionDirs) => {
  const hasNavItems = [...active, ...disabled].some(e => e.navItem);
  const navItems = hasNavItems ? new Map((await findNavItems({ extensionDirs }))[1].map(item => [item.key, item])) : null;
  await write(join(rootDir, GLOBAL_FILE), rebuildCopies(active, navItems));
  await write(join(rootDir, GLOBAL_DISABLED_FILE), disabled);
};

/*
  Brings every menu up to date with the extensions that are installed now. Run when extensions are
  installed, enabled, disabled or removed, so what an extension supplied leaves the site with it.
*/
export const resyncMenus = async (rootDir, extensionDirs) => {
  const stores = await readStores(rootDir);
  if(![...stores.active, ...stores.disabled].some(e => e.navItem)) return;
  await writeStores(rootDir, stores, extensionDirs);
};
