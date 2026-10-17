import { readFile } from 'fs/promises';
import { basename, dirname } from 'path';
import scanDir from '../fs/scanDir.js';

const WRAPPER = /^\s*(?:<!--[\s\S]*?-->\s*)*<menu-item((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*)<\/menu-item>\s*$/;
const ATTRIBUTE = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)')/g;
const ID = /^[\w-]+$/;

/*
  What kempo itself offers, so it is there on every site and needs no extension. The spacer takes up
  the space left in a menu that is laid out in a row, which pushes the items after it to the far side.
*/
const BUILT_IN = [{
  key: 'kempo:spacer',
  extension: 'kempo',
  id: 'spacer',
  label: 'Spacer',
  description: 'A flexible gap that pushes the items after it to the far side of the menu, such as the account link to the right. For a menu laid out in a row.',
  icon: '',
  markup: '<div class="flex"></div>'
}];

/*
  The items enabled extensions offer for a site's menus. An extension ships a `*.menu-item.html` file
  anywhere in its `public/` folder:

    <menu-item id="cart" label="Cart" description="The shopping cart." icon-src="/commerce/icons/shopping_cart.svg">
      <k-commerce-cart-button></k-commerce-cart-button>
    </menu-item>

  `icon` is the name of an icon in the shared sets; `icon-src` is the path to an icon file the extension ships
  (`/commerce/icons/shopping_cart.svg`), and wins when both are given.

  Kempo's own items (a spacer) come first, always.

  Its content is what is rendered where an admin puts the item. It may include a <script> for the
  element it uses. An item is named `<extension>:<id>`, which is what a menu stores. A file with no
  <menu-item> wrapper, or without an id and a label, is skipped rather than breaking the others.

  `extensionDirs` overrides where extensions are read from, as for the other menu functions; each is
  an extension's public folder, so its package name is the folder above it.
*/
export default async ({ extensionDirs } = {}) => {
  const dirs = extensionDirs ?? await (await import('../extensions/contentDirs.js')).extensionPublicDirs();
  const items = BUILT_IN.map(item => ({ ...item }));

  for(const dir of dirs){
    const extension = basename(dirname(dir));
    const files = await scanDir(dir, dir, async (fullPath, entry) =>
      !entry.isDirectory() && entry.name.endsWith('.menu-item.html') ? fullPath : null);

    for(const file of files.sort()){
      const match = WRAPPER.exec(await readFile(file, 'utf-8'));
      if(!match) continue;
      const attrs = {};
      let a;
      ATTRIBUTE.lastIndex = 0;
      while((a = ATTRIBUTE.exec(match[1])) !== null) attrs[a[1]] = a[2] ?? a[3];
      if(!ID.test(attrs.id || '') || !String(attrs.label || '').trim()) continue;
      items.push({
        key: `${extension}:${attrs.id}`,
        extension,
        id: attrs.id,
        label: attrs.label.trim(),
        description: attrs.description || '',
        icon: attrs.icon || '',
        iconSrc: attrs['icon-src'] || '',
        markup: match[2].trim()
      });
    }
  }

  return [null, items];
};
