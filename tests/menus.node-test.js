import { mkdtemp, mkdir, readFile, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  Menus are named things a site creates and then shows in the places its theme offers, like WordPress.
  Underneath they are plain global content: a menu and its items live in a place no template has, and
  each place a menu is shown in gets a copy of its enabled items, which is what the site renders. These
  cover the parts that must not drift: that the copies always match the items, that a place shows one
  menu while a menu can be shown in several, and that the markers survive every save.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async file => (await import(pathToFileURL(path.join(root, file)).href));
const util = async name => (await load(`server/utils/menus/${name}.js`)).default;

const { parseEntries, serializeEntries } = await load('server/utils/global-content/helpers.js');
const { parseLink, buildLink } = await load('server/utils/menus/markup.js');
const { extractContentBlocks, replaceLocations } = await load('node_modules/kempo-server/src/templating/parse.js');
const findMenuLocations = await util('findMenuLocations');
const findNavItems = await util('findNavItems');
const { resyncMenus } = await load('server/utils/menus/store.js');
const listMenus = await util('listMenus');
const saveMenu = await util('saveMenu');
const deleteMenu = await util('deleteMenu');
const assignMenuLocation = await util('assignMenuLocation');
const saveMenuItem = await util('saveMenuItem');
const deleteMenuItems = await util('deleteMenuItems');
const setMenuItemEnabled = await util('setMenuItemEnabled');
const reorderMenuItems = await util('reorderMenuItems');
const adoptMenuItem = await util('adoptMenuItem');
const listGlobalContent = (await load('server/utils/global-content/listGlobalContent.js')).default;

const NAV = [
  '<fragment><nav>',
  '<location name="main-nav-links" label="Main menu" menu="true" />',
  '<location name="mobile-nav-links" label="Mobile menu" menu="true" />',
  '<location name="footer-links" label="Footer" menu="true" />',
  '<location name="head" />',
  '</nav></fragment>',
].join('\n');

const withSite = async fn => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kempo-menus-'));
  try {
    await writeFile(path.join(dir, 'nav.fragment.html'), NAV);
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const GLOBAL = dir => path.join(dir, 'kempo-global.global.html');

const list = async (rootDir, extensionDirs = [], extensions = []) => (await listMenus({ rootDir, extensionDirs, extensions }))[1];

const findPages = await util('findPages');

const makeMenu = async (rootDir, name, ...labels) => {
  const [, { id }] = await saveMenu({ rootDir, name });
  const itemIds = [];
  for(const label of labels) itemIds.push((await saveMenuItem({ rootDir, menuId: id, label, href: `/${label.toLowerCase()}` }))[1].id);
  return { id, itemIds };
};

/* What the site renders into a place: the real renderer, fed the site's global content. */
const rendered = async (rootDir, location) => {
  const blocks = extractContentBlocks(await readFile(GLOBAL(rootDir), 'utf8'));
  return replaceLocations(`<location name="${location}" />`, blocks).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};


/* An extension's public folder holding the given menu item files, as the extension scan expects. */
const makeExtension = async (dir, name, files) => {
  const publicDir = path.join(dir, 'ext', 'node_modules', name, 'public');
  await mkdir(publicDir, { recursive: true });
  for(const [file, content] of Object.entries(files)) await writeFile(path.join(publicDir, file), content);
  return publicDir;
};

const CART = '<!-- the cart -->\n<menu-item id="cart" label="Cart" description="The cart button." icon="shopping_cart" icon-src="/shop/icons/cart.svg">\n<span class="cart">Basket</span>\n<script type="module" src="/shop/Cart.js"></script>\n</menu-item>';

const names = items => items.map(i => i.label).join(', ');

export default {
  'markers, assignments and awkward characters survive a parse and a save': async ({ pass, fail }) => {
    const raw = '<content id="m" name="A &quot;big&quot; &lt;menu&gt;" owner="custom" author="" created="c" updated="u" locked="false" location="menu:m" priority="0" menu="m" menu-locations="a,b" data-flag="yes">\n\n</content>\n<content id="i@a" name="N" owner="custom" author="" created="" updated="" locked="false" location="a" priority="3" menu="m" menu-copy="i">\n<a href="/">Home</a>\n</content>';
    const [definition, copy] = parseEntries(raw);
    if(definition.name !== 'A "big" <menu>' || definition.menu !== 'm' || definition.menuLocations.join() !== 'a,b' || definition.extra['data-flag'] !== 'yes') return fail(JSON.stringify(definition));
    if(copy.menuCopyOf !== 'i' || copy.menuLocations !== null) return fail(JSON.stringify(copy));
    const again = serializeEntries([definition, copy]);
    if(serializeEntries(parseEntries(again)) !== again) return fail('a second round trip changed it');
    pass('');
  },

  'an entry that is not part of a menu is written without any menu attribute': async ({ pass, fail }) => {
    const [entry] = parseEntries('<content id="a" name="N" location="l"><p>x</p></content>');
    if(entry.menu !== '' || entry.menuLocations !== null || /menu/.test(serializeEntries([entry]))) return fail('a plain entry gained a marker');
    pass('');
  },

  'a link round-trips through the markup, with its icon, new tab and awkward characters': async ({ pass, fail }) => {
    const [error, markup] = buildLink({ label: 'Q&A "FAQ" <b>', href: '/faq?a=1&b=2', icon: 'help', newTab: true });
    if(error) return fail(error.msg);
    if(markup.includes('<b>')) return fail(`label not escaped: ${markup}`);
    const link = parseLink(markup);
    if(link.label !== 'Q&A "FAQ" <b>' || link.href !== '/faq?a=1&b=2' || link.icon !== 'help' || link.newTab !== true) return fail(JSON.stringify(link));
    pass('');
  },

  'markup that is more than one link is not treated as a menu item': async ({ pass, fail }) => {
    for(const markup of ['<span>x</span>', '<a href="/a">A</a><a href="/b">B</a>', '<a href="/a"><b>A</b></a>', '', '<a>no href</a>']){
      if(parseLink(markup) !== null) return fail(`accepted ${markup}`);
    }
    pass('');
  },

  'a link that runs script, or is missing its label or address, is refused': async ({ pass, fail }) => {
    for(const input of [
      { label: 'x', href: 'javascript:alert(1)' },
      { label: 'x', href: ' JavaScript:alert(1)' },
      { label: 'x', href: 'data:text/html,hi' },
      { label: ' ', href: '/x' },
      { label: 'x', href: '' },
      { label: 'x', href: '/x', icon: 'bad name"' },
    ]){
      const [error] = buildLink(input);
      if(error?.code !== 400) return fail(`accepted ${JSON.stringify(input)}`);
    }
    pass('');
  },

  'only a location marked menu="true" can show a menu': async ({ pass, fail }) => {
    await withSite(async dir => {
      const [error, locations] = await findMenuLocations({ rootDir: dir });
      if(error) return fail(error.msg);
      if(locations.map(l => `${l.location}:${l.label}`).join() !== 'main-nav-links:Main menu,mobile-nav-links:Mobile menu,footer-links:Footer') return fail(JSON.stringify(locations));
      pass('');
    });
  },

  'a site with no menu slot has no places to show a menu': async ({ pass, fail }) => {
    await withSite(async dir => {
      await writeFile(path.join(dir, 'nav.fragment.html'), '<fragment><location name="x" /></fragment>');
      const { locations } = await list(dir);
      if(locations.length) return fail(JSON.stringify(locations));
      pass('');
    });
  },

  'a new menu is empty and is not shown anywhere until it is assigned': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Footer links', 'Terms');
      const { menus, locations } = await list(dir);
      if(menus.length !== 1 || menus[0].name !== 'Footer links' || menus[0].locations.length) return fail(JSON.stringify(menus));
      if(locations.some(l => l.menuId)) return fail('a menu appeared in a place without being assigned');
      const raw = await readFile(GLOBAL(dir), 'utf8');
      if(raw.includes('location="footer-links"')) return fail('an unassigned menu was copied somewhere');
      void id;
      pass('');
    });
  },

  'menus and their items are left out of the global content list unless asked for': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Main', 'Home');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      const [, shown] = await listGlobalContent({ rootDir: dir, includeMenu: false });
      const [, all] = await listGlobalContent({ rootDir: dir });
      if(shown.total !== 0 || all.total < 3) return fail(`${shown.total}/${all.total}`);
      pass('');
    });
  },

  'assigning a menu to a place makes the site render its items there, in order': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Main', 'Home', 'Blog', 'Contact');
      const [error] = await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      if(error) return fail(error.msg);
      const shown = await rendered(dir, 'main-nav-links');
      if(shown !== 'Home Blog Contact') return fail(shown);
      pass('');
    });
  },

  'the mobile and footer menus can differ': async ({ pass, fail }) => {
    await withSite(async dir => {
      const main = await makeMenu(dir, 'Main', 'Home', 'Shop');
      const footer = await makeMenu(dir, 'Footer', 'Terms', 'Privacy');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: main.id });
      await assignMenuLocation({ rootDir: dir, location: 'mobile-nav-links', menuId: main.id });
      await assignMenuLocation({ rootDir: dir, location: 'footer-links', menuId: footer.id });
      const shown = [await rendered(dir, 'main-nav-links'), await rendered(dir, 'mobile-nav-links'), await rendered(dir, 'footer-links')];
      if(shown.join(' | ') !== 'Home Shop | Home Shop | Terms Privacy') return fail(shown.join(' | '));
      pass('');
    });
  },

  'a place shows one menu: choosing another takes the place from the first': async ({ pass, fail }) => {
    await withSite(async dir => {
      const a = await makeMenu(dir, 'A', 'One');
      const b = await makeMenu(dir, 'B', 'Two');
      await assignMenuLocation({ rootDir: dir, location: 'footer-links', menuId: a.id });
      await assignMenuLocation({ rootDir: dir, location: 'footer-links', menuId: b.id });
      const { menus, locations } = await list(dir);
      if(menus.find(m => m.id === a.id).locations.length || locations.find(l => l.location === 'footer-links').menuId !== b.id) return fail(JSON.stringify(menus));
      if(await rendered(dir, 'footer-links') !== 'Two') return fail(await rendered(dir, 'footer-links'));
      pass('');
    });
  },

  'choosing no menu empties the place': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Main', 'Home');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      const [error] = await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: '' });
      if(error) return fail(error.msg);
      if(await rendered(dir, 'main-nav-links') !== '') return fail(await rendered(dir, 'main-nav-links'));
      pass('');
    });
  },

  'a menu cannot be shown in a place the theme does not offer, or a menu that does not exist': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Main', 'Home');
      const [notAMenuSlot] = await assignMenuLocation({ rootDir: dir, location: 'head', menuId: id });
      const [typo] = await assignMenuLocation({ rootDir: dir, location: 'main-nav-lnks', menuId: id });
      const [noMenu] = await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: 'nope' });
      if(notAMenuSlot?.code !== 400 || typo?.code !== 400 || noMenu?.code !== 404) return fail(`${notAMenuSlot?.code}/${typo?.code}/${noMenu?.code}`);
      pass('');
    });
  },

  'adding a link to a place with no menu makes the menu, shows it there and puts the link on the site': async ({ pass, fail }) => {
    await withSite(async dir => {
      const [error, result] = await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Products', href: '/products' });
      if(error) return fail(error.msg);
      const { menus, locations } = await list(dir);
      const place = locations.find(l => l.location === 'main-nav-links');
      if(menus.length !== 1 || menus[0].name !== 'Main menu' || place.menuId !== result.menuId) return fail(JSON.stringify({ menus, place }));
      if(await rendered(dir, 'main-nav-links') !== 'Products') return fail(await rendered(dir, 'main-nav-links'));
      pass('');
    });
  },

  'adding a second link to the same place joins the same menu': async ({ pass, fail }) => {
    await withSite(async dir => {
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Products', href: '/products' });
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Blog', href: '/blog' });
      const { menus } = await list(dir);
      if(menus.length !== 1 || names(menus[0].items) !== 'Products, Blog') return fail(JSON.stringify(menus));
      if(await rendered(dir, 'main-nav-links') !== 'Products Blog') return fail(await rendered(dir, 'main-nav-links'));
      pass('');
    });
  },

  'adding a link to a place that shares a menu with another place adds it to both': async ({ pass, fail }) => {
    await withSite(async dir => {
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Products', href: '/products' });
      const { menus } = await list(dir);
      await assignMenuLocation({ rootDir: dir, location: 'mobile-nav-links', menuId: menus[0].id });
      await saveMenuItem({ rootDir: dir, location: 'mobile-nav-links', label: 'Blog', href: '/blog' });
      const shown = [await rendered(dir, 'main-nav-links'), await rendered(dir, 'mobile-nav-links')];
      if(shown.join(' | ') !== 'Products Blog | Products Blog') return fail(shown.join(' | '));
      pass('');
    });
  },

  'a link cannot be added to a place the theme does not offer as a menu': async ({ pass, fail }) => {
    await withSite(async dir => {
      const [notAMenuSlot] = await saveMenuItem({ rootDir: dir, location: 'head', label: 'x', href: '/x' });
      const [typo] = await saveMenuItem({ rootDir: dir, location: 'main-nav-lnks', label: 'x', href: '/x' });
      const [nothing] = await saveMenuItem({ rootDir: dir, label: 'x', href: '/x' });
      if(notAMenuSlot?.code !== 400 || typo?.code !== 400 || nothing?.code !== 404) return fail(`${notAMenuSlot?.code}/${typo?.code}/${nothing?.code}`);
      if((await list(dir)).menus.length) return fail('a refused link still left a menu behind');
      pass('');
    });
  },

  'an extension offers an item with a file in its public folder, and malformed ones are skipped': async ({ pass, fail }) => {
    await withSite(async dir => {
      const publicDir = await makeExtension(dir, 'kempo-shop', {
        'cart.menu-item.html': CART,
        'no-wrapper.menu-item.html': '<span>x</span>',
        'no-label.menu-item.html': '<menu-item id="x"><span>x</span></menu-item>',
        'bad-id.menu-item.html': '<menu-item id="a b" label="Bad"><span>x</span></menu-item>',
      });
      const [error, items] = await findNavItems({ extensionDirs: [publicDir] });
      if(error) return fail(error.msg);
      const supplied = items.filter(i => i.extension !== 'kempo');
      if(supplied.length !== 1) return fail(JSON.stringify(items.map(i => i.key)));
      const [cart] = supplied;
      if(cart.key !== 'kempo-shop:cart' || cart.extension !== 'kempo-shop' || cart.label !== 'Cart' || cart.icon !== 'shopping_cart' || cart.iconSrc !== '/shop/icons/cart.svg' || cart.description !== 'The cart button.') return fail(JSON.stringify(cart));
      if(!cart.markup.includes('<span class="cart">Basket</span>') || !cart.markup.includes('/shop/Cart.js') || cart.markup.includes('menu-item')) return fail(cart.markup);
      pass('');
    });
  },

  'kempo offers a spacer itself, on every site, with no extension': async ({ pass, fail }) => {
    await withSite(async dir => {
      const [, items] = await findNavItems({ extensionDirs: [] });
      const spacer = items.find(i => i.key === 'kempo:spacer');
      if(!spacer || spacer.label !== 'Spacer' || spacer.markup !== '<div class="flex"></div>' || !spacer.description) return fail(JSON.stringify(items));
      const { navItems } = await list(dir, []);
      if(!navItems.some(n => n.key === 'kempo:spacer')) return fail('the Menus page is not told about it');
      pass('');
    });
  },

  'a spacer sits between items on the site, and stays when no extension is installed': async ({ pass, fail }) => {
    await withSite(async dir => {
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Home', href: '/', extensionDirs: [] });
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', navItem: 'kempo:spacer', extensionDirs: [] });
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Account', href: '/account/', extensionDirs: [] });
      const place = async () => replaceLocations('<location name="main-nav-links" />', extractContentBlocks(await readFile(GLOBAL(dir), 'utf8'))).split(/\s+/).join(' ');
      const html = await place();
      const at = text => html.indexOf(text);
      if(at('>Home<') < 0 || !(at('>Home<') < at('<div class="flex"></div>') && at('<div class="flex"></div>') < at('>Account<'))) return fail(html);
      await resyncMenus(dir, []);
      const again = await place();
      if(again !== html) return fail(`resync changed it: ${again}`);
      const { menus } = await list(dir, []);
      if(!menus[0].items[1].available || menus[0].items[1].navItem !== 'kempo:spacer') return fail(JSON.stringify(menus[0].items[1]));
      pass('');
    });
  },

  'the Menus page is told what extensions offer': async ({ pass, fail }) => {
    await withSite(async dir => {
      const publicDir = await makeExtension(dir, 'kempo-shop', { 'cart.menu-item.html': CART });
      const { navItems } = await list(dir, [publicDir]);
      const cart = navItems.find(n => n.key === 'kempo-shop:cart');
      if(!cart || navItems.some(n => 'markup' in n)) return fail(JSON.stringify(navItems));
      pass('');
    });
  },

  'an extension\'s item is added to a place like a link, and the site renders its markup there': async ({ pass, fail }) => {
    await withSite(async dir => {
      const publicDir = await makeExtension(dir, 'kempo-shop', { 'cart.menu-item.html': CART });
      const [error] = await saveMenuItem({ rootDir: dir, location: 'main-nav-links', navItem: 'kempo-shop:cart', extensionDirs: [publicDir] });
      if(error) return fail(error.msg);
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Blog', href: '/blog', extensionDirs: [publicDir] });
      const raw = await readFile(GLOBAL(dir), 'utf8');
      if(!raw.includes('<script type="module" src="/shop/Cart.js"></script>')) return fail('the extension\'s markup is not in the file');
      if(await rendered(dir, 'main-nav-links') !== 'Basket Blog') return fail(await rendered(dir, 'main-nav-links'));
      const { menus } = await list(dir, [publicDir]);
      const item = menus[0].items[0];
      if(item.label !== 'Cart' || item.navItem !== 'kempo-shop:cart' || !item.available || item.editable) return fail(JSON.stringify(item));
      pass('');
    });
  },

  'an extension\'s item shows in every place its menu is shown': async ({ pass, fail }) => {
    await withSite(async dir => {
      const publicDir = await makeExtension(dir, 'kempo-shop', { 'cart.menu-item.html': CART });
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', navItem: 'kempo-shop:cart', extensionDirs: [publicDir] });
      const { menus } = await list(dir, [publicDir]);
      await assignMenuLocation({ rootDir: dir, location: 'mobile-nav-links', menuId: menus[0].id, extensionDirs: [publicDir] });
      const shown = [await rendered(dir, 'main-nav-links'), await rendered(dir, 'mobile-nav-links')];
      if(shown.join(' | ') !== 'Basket | Basket') return fail(shown.join(' | '));
      pass('');
    });
  },

  'an item that is not offered cannot be added, and one from an extension cannot be edited': async ({ pass, fail }) => {
    await withSite(async dir => {
      const publicDir = await makeExtension(dir, 'kempo-shop', { 'cart.menu-item.html': CART });
      const [missing] = await saveMenuItem({ rootDir: dir, location: 'main-nav-links', navItem: 'kempo-shop:nope', extensionDirs: [publicDir] });
      if(missing?.code !== 404) return fail(`missing: ${JSON.stringify(missing)}`);
      if((await list(dir, [publicDir])).menus.length) return fail('a refused item left a menu behind');
      const [, { id }] = await saveMenuItem({ rootDir: dir, location: 'main-nav-links', navItem: 'kempo-shop:cart', extensionDirs: [publicDir] });
      const [edit] = await saveMenuItem({ rootDir: dir, id, label: 'x', href: '/x', extensionDirs: [publicDir] });
      if(edit?.code !== 400) return fail(`edit: ${JSON.stringify(edit)}`);
      pass('');
    });
  },

  'when the extension goes the item leaves the site but stays in its menu, and returns with it': async ({ pass, fail }) => {
    await withSite(async dir => {
      const publicDir = await makeExtension(dir, 'kempo-shop', { 'cart.menu-item.html': CART });
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', navItem: 'kempo-shop:cart', extensionDirs: [publicDir] });
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Blog', href: '/blog', extensionDirs: [publicDir] });
      await resyncMenus(dir, []);
      if(await rendered(dir, 'main-nav-links') !== 'Blog') return fail(`gone: ${await rendered(dir, 'main-nav-links')}`);
      const gone = await list(dir, []);
      const item = gone.menus[0].items.find(i => i.navItem);
      if(!item || item.available) return fail(`should be listed as unavailable: ${JSON.stringify(gone.menus[0].items)}`);
      await resyncMenus(dir, [publicDir]);
      if(await rendered(dir, 'main-nav-links') !== 'Basket Blog') return fail(`back: ${await rendered(dir, 'main-nav-links')}`);
      pass('');
    });
  },

  'a changed extension item is brought up to date when menus are resynced': async ({ pass, fail }) => {
    await withSite(async dir => {
      const publicDir = await makeExtension(dir, 'kempo-shop', { 'cart.menu-item.html': CART });
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', navItem: 'kempo-shop:cart', extensionDirs: [publicDir] });
      await writeFile(path.join(publicDir, 'cart.menu-item.html'), CART.replace('Basket', 'Trolley').replace('label="Cart"', 'label="Trolley"'));
      await resyncMenus(dir, [publicDir]);
      if(await rendered(dir, 'main-nav-links') !== 'Trolley') return fail(await rendered(dir, 'main-nav-links'));
      const { menus } = await list(dir, [publicDir]);
      if(menus[0].items[0].label !== 'Trolley') return fail(JSON.stringify(menus[0].items[0]));
      pass('');
    });
  },

  'resyncing a site with no extension items leaves its files alone': async ({ pass, fail }) => {
    await withSite(async dir => {
      await saveMenuItem({ rootDir: dir, location: 'main-nav-links', label: 'Blog', href: '/blog' });
      const before = await readFile(GLOBAL(dir), 'utf8');
      await resyncMenus(dir, []);
      if(await readFile(GLOBAL(dir), 'utf8') !== before) return fail('the file was rewritten');
      pass('');
    });
  },

  'hiding an extension\'s item and showing it again keeps it in place': async ({ pass, fail }) => {
    await withSite(async dir => {
      const publicDir = await makeExtension(dir, 'kempo-shop', { 'cart.menu-item.html': CART });
      const [, { id }] = await saveMenuItem({ rootDir: dir, location: 'main-nav-links', navItem: 'kempo-shop:cart', extensionDirs: [publicDir] });
      await setMenuItemEnabled({ rootDir: dir, id, enabled: false, extensionDirs: [publicDir] });
      if(await rendered(dir, 'main-nav-links') !== '') return fail('a hidden item should not show');
      await setMenuItemEnabled({ rootDir: dir, id, enabled: true, extensionDirs: [publicDir] });
      if(await rendered(dir, 'main-nav-links') !== 'Basket') return fail(await rendered(dir, 'main-nav-links'));
      pass('');
    });
  },

  'the link picker lists the pages extensions serve under every one of their scopes, not only the site\'s': async ({ pass, fail }) => {
    await withSite(async dir => {
      await writeFile(path.join(dir, 'index.page.html'), '<page title="Home"><content>x</content></page>');
      await writeFile(path.join(dir, 'about.page.html'), '<page title="About us"><content>x</content></page>');
      await mkdir(path.join(dir, 'products'), { recursive: true });
      await writeFile(path.join(dir, 'products', 'dup.page.html'), '<page title="The site\'s own"><content>x</content></page>');

      const root = path.join(dir, 'ext', 'node_modules', 'kempo-shop');
      for(const [file, content] of Object.entries({
        'public/index.page.html': '<page title="Products"><content>x</content></page>',
        'public/dup.page.html': '<page title="The extension\'s"><content>x</content></page>',
        'public/[slug]/index.page.html': '<page title="One product"><content>x</content></page>',
        'public/cart/index.page.html': '<page title="Cart"><content>x</content></page>',
        'public-categories/index.page.html': '<page title="Categories"><content>x</content></page>',
        'public-categories/deep/index.page.html': '<page title="Deep"><content>x</content></page>',
        'public-categories/secret.page.html': '<!--\nhidden: true\n-->\n<page title="Secret"><content>x</content></page>',
        'public/notes.txt': 'not a page',
        'elsewhere/not-served.page.html': '<page title="Not served"><content>x</content></page>',
      })){
        await mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await writeFile(path.join(root, file), content);
      }
      const shop = { name: 'kempo-shop', root, kempo: { 'public-scope': 'products', 'public-scopes': { categories: 'public-categories' } } };

      const [error, pages] = await findPages({ rootDir: dir, extensions: [shop] });
      if(error) return fail(error.msg);
      const byUrl = Object.fromEntries(pages.map(page => [page.url, page]));
      const urls = pages.map(page => page.url);
      for(const url of ['/', '/about', '/products/', '/products/cart/', '/categories/', '/categories/deep/']){
        if(!byUrl[url]) return fail(`${url} is missing: ${urls.join(', ')}`);
      }
      if(byUrl['/categories/'].title !== 'Categories' || byUrl['/categories/'].owner !== 'kempo-shop') return fail(JSON.stringify(byUrl['/categories/']));
      if(urls.some(url => url.includes('['))) return fail('a page with a [param] has no one address');
      if(urls.some(url => /secret|not-served|notes/.test(url))) return fail(`a hidden page, a folder no scope serves or a non-page was listed: ${urls.join(', ')}`);
      if(urls.filter(url => url === '/products/dup').length !== 1 || byUrl['/products/dup'].owner === 'kempo-shop') return fail('the site should win an address both have');

      const menus = await list(dir, [], [shop]);
      if(!menus.pages.some(page => page.url === '/categories/')) return fail('the Menus page is not given them');
      pass('');
    });
  },

  'a site with no extension pages still lists its own': async ({ pass, fail }) => {
    await withSite(async dir => {
      await writeFile(path.join(dir, 'about.page.html'), '<page title="About us"><content>x</content></page>');
      const [, pages] = await findPages({ rootDir: dir, extensions: [] });
      if(pages.map(page => page.url).join() !== '/about') return fail(JSON.stringify(pages));
      pass('');
    });
  },

  'new items go to the end of the menu': async ({ pass, fail }) => {
    await withSite(async dir => {
      await makeMenu(dir, 'Main', 'Home', 'Blog', 'Contact');
      const { menus } = await list(dir);
      if(names(menus[0].items) !== 'Home, Blog, Contact') return fail(names(menus[0].items));
      pass('');
    });
  },

  'editing an item changes it in every place the menu is shown, and keeps its position': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id, itemIds } = await makeMenu(dir, 'Main', 'Home', 'Blog', 'Contact');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      await assignMenuLocation({ rootDir: dir, location: 'mobile-nav-links', menuId: id });
      const [error] = await saveMenuItem({ rootDir: dir, id: itemIds[1], label: 'News', href: '/news', newTab: true });
      if(error) return fail(error.msg);
      const shown = [await rendered(dir, 'main-nav-links'), await rendered(dir, 'mobile-nav-links')];
      if(shown.join(' | ') !== 'Home News Contact | Home News Contact') return fail(shown.join(' | '));
      const { menus } = await list(dir);
      if(menus[0].items[1].href !== '/news' || !menus[0].items[1].newTab) return fail(JSON.stringify(menus[0].items[1]));
      pass('');
    });
  },

  'hiding an item takes it off the site and showing it puts it back where it was': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id, itemIds } = await makeMenu(dir, 'Main', 'Home', 'Blog', 'Contact');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      await setMenuItemEnabled({ rootDir: dir, id: itemIds[1], enabled: false });
      if(await rendered(dir, 'main-nav-links') !== 'Home Contact') return fail(await rendered(dir, 'main-nav-links'));
      const { menus } = await list(dir);
      if(!menus[0].items[1].disabled || menus[0].items[1].label !== 'Blog') return fail('a hidden item should still be listed, as hidden');
      await setMenuItemEnabled({ rootDir: dir, id: itemIds[1], enabled: true });
      if(await rendered(dir, 'main-nav-links') !== 'Home Blog Contact') return fail(await rendered(dir, 'main-nav-links'));
      pass('');
    });
  },

  'a hidden item can still be edited': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { itemIds } = await makeMenu(dir, 'Main', 'Home');
      await setMenuItemEnabled({ rootDir: dir, id: itemIds[0], enabled: false });
      const [error] = await saveMenuItem({ rootDir: dir, id: itemIds[0], label: 'Start', href: '/start' });
      if(error) return fail(error.msg);
      const { menus } = await list(dir);
      if(menus[0].items[0].label !== 'Start' || !menus[0].items[0].disabled) return fail(JSON.stringify(menus[0].items));
      pass('');
    });
  },

  'deleting items removes them everywhere': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id, itemIds } = await makeMenu(dir, 'Main', 'Home', 'Blog');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      const [error] = await deleteMenuItems({ rootDir: dir, ids: [itemIds[0]] });
      if(error) return fail(error.msg);
      if(await rendered(dir, 'main-nav-links') !== 'Blog') return fail(await rendered(dir, 'main-nav-links'));
      const [missing] = await deleteMenuItems({ rootDir: dir, ids: ['nope'] });
      if(missing?.code !== 404) return fail('a missing item should be reported');
      pass('');
    });
  },

  'reordering puts the items in the new order in every place': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id, itemIds } = await makeMenu(dir, 'Main', 'A', 'B', 'C');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      await assignMenuLocation({ rootDir: dir, location: 'footer-links', menuId: id });
      const [error] = await reorderMenuItems({ rootDir: dir, menuId: id, ids: [itemIds[2], itemIds[0], itemIds[1]] });
      if(error) return fail(error.msg);
      const shown = [await rendered(dir, 'main-nav-links'), await rendered(dir, 'footer-links')];
      if(shown.join(' | ') !== 'C A B | C A B') return fail(shown.join(' | '));
      pass('');
    });
  },

  'reordering separates items that shared a priority': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id, itemIds } = await makeMenu(dir, 'Main', 'A', 'B');
      await writeFile(GLOBAL(dir), (await readFile(GLOBAL(dir), 'utf8')).replace(/priority="-?\d+"/g, 'priority="0"'));
      await reorderMenuItems({ rootDir: dir, menuId: id, ids: [itemIds[1], itemIds[0]] });
      const { menus } = await list(dir);
      if(names(menus[0].items) !== 'B, A') return fail(names(menus[0].items));
      pass('');
    });
  },

  'items of another menu cannot be reordered into this one': async ({ pass, fail }) => {
    await withSite(async dir => {
      const a = await makeMenu(dir, 'A', 'One');
      const b = await makeMenu(dir, 'B', 'Two');
      const [error] = await reorderMenuItems({ rootDir: dir, menuId: a.id, ids: [b.itemIds[0]] });
      if(error?.code !== 404) return fail(JSON.stringify(error));
      pass('');
    });
  },

  'renaming a menu keeps its items and where it is shown': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Main', 'Home');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      const [error] = await saveMenu({ rootDir: dir, id, name: 'Header "primary"' });
      if(error) return fail(error.msg);
      const { menus } = await list(dir);
      if(menus[0].name !== 'Header "primary"' || menus[0].locations.join() !== 'main-nav-links' || menus[0].items.length !== 1) return fail(JSON.stringify(menus[0]));
      if(await rendered(dir, 'main-nav-links') !== 'Home') return fail('the place stopped showing it');
      pass('');
    });
  },

  'deleting a menu removes its items and empties the places it was shown': async ({ pass, fail }) => {
    await withSite(async dir => {
      const a = await makeMenu(dir, 'A', 'One', 'Two');
      const b = await makeMenu(dir, 'B', 'Three');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: a.id });
      await assignMenuLocation({ rootDir: dir, location: 'footer-links', menuId: b.id });
      await setMenuItemEnabled({ rootDir: dir, id: a.itemIds[0], enabled: false });
      const [error] = await deleteMenu({ rootDir: dir, id: a.id });
      if(error) return fail(error.msg);
      const raw = await readFile(GLOBAL(dir), 'utf8');
      if(/One|Two/.test(raw) || !raw.includes('Three')) return fail(raw);
      const { menus } = await list(dir);
      if(menus.length !== 1 || menus[0].id !== b.id) return fail(JSON.stringify(menus));
      const [missing] = await deleteMenu({ rootDir: dir, id: a.id });
      if(missing?.code !== 404) return fail('deleting twice should report not found');
      pass('');
    });
  },

  'a menu needs a name, and an item needs a menu that exists': async ({ pass, fail }) => {
    await withSite(async dir => {
      const [noName] = await saveMenu({ rootDir: dir, name: '  ' });
      const [noMenu] = await saveMenuItem({ rootDir: dir, menuId: 'nope', label: 'x', href: '/x' });
      if(noName?.code !== 400 || noMenu?.code !== 404) return fail(`${noName?.code}/${noMenu?.code}`);
      pass('');
    });
  },

  'what an extension adds to a place is listed there but cannot be changed here': async ({ pass, fail }) => {
    await withSite(async dir => {
      const extRoot = path.join(dir, 'ext', 'node_modules', 'kempo-shop', 'public');
      await mkdir(extRoot, { recursive: true });
      await writeFile(path.join(extRoot, 'nav.global.html'), '<content location="main-nav-links" priority="5"><a href="/shop">Shop</a></content>');
      const { locations } = await list(dir, [extRoot]);
      const place = locations.find(l => l.location === 'main-nav-links');
      const item = place.extensionItems[0];
      if(!item || item.owner !== 'kempo-shop' || item.label !== 'Shop' || item.href !== '/shop') return fail(JSON.stringify(place.extensionItems));
      await writeFile(GLOBAL(dir), '<content id="theirs" name="Theirs" owner="kempo-shop" location="main-nav-links" priority="1"><a href="/s">S</a></content>');
      const [error] = await saveMenuItem({ rootDir: dir, id: 'theirs', label: 'x', href: '/x' });
      if(error?.code !== 404) return fail('an extension item should not be editable here');
      pass('');
    });
  },

  'an extension item shows with a menu\'s items on the site': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Main', 'Home');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      await writeFile(GLOBAL(dir), (await readFile(GLOBAL(dir), 'utf8')) + '<content id="x" name="Shop" owner="kempo-shop" location="main-nav-links" priority="500">\n<a href="/shop">Shop</a>\n</content>\n');
      if(await rendered(dir, 'main-nav-links') !== 'Shop Home') return fail(await rendered(dir, 'main-nav-links'));
      pass('');
    });
  },

  'an existing single link in a place is offered, and moved into that place\'s menu only when asked': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Main', 'Home');
      await assignMenuLocation({ rootDir: dir, location: 'main-nav-links', menuId: id });
      await writeFile(GLOBAL(dir), (await readFile(GLOBAL(dir), 'utf8')) + [
        '<content id="old" name="Old link" owner="custom" author="" created="" updated="" locked="false" location="main-nav-links" priority="4">\n<a href="/old">Old</a>\n</content>',
        '<content id="fancy" name="Fancy" owner="custom" author="" created="" updated="" locked="false" location="main-nav-links" priority="2">\n<div>not a link</div>\n</content>',
      ].join('\n') + '\n');
      const before = (await list(dir)).locations.find(l => l.location === 'main-nav-links');
      if(before.candidates.map(c => c.id).join() !== 'old') return fail(JSON.stringify(before.candidates));
      if(!(await rendered(dir, 'main-nav-links')).includes('Old')) return fail('the link should be showing before it is moved');
      const [error] = await adoptMenuItem({ rootDir: dir, id: 'old' });
      if(error) return fail(error.msg);
      const after = await list(dir);
      if(after.locations.find(l => l.location === 'main-nav-links').candidates.length) return fail('it is still offered');
      if(names(after.menus[0].items) !== 'Home, Old') return fail(names(after.menus[0].items));
      const shown = await rendered(dir, 'main-nav-links');
      if((shown.match(/Old/g) || []).length !== 1) return fail(`it should show once, got: ${shown}`);
      pass('');
    });
  },

  'moving a link from a place with no menu makes one, shown there, so the site does not change': async ({ pass, fail }) => {
    await withSite(async dir => {
      await writeFile(GLOBAL(dir), '<content id="old" name="Old link" owner="custom" author="" created="" updated="" locked="false" location="footer-links" priority="4">\n<a href="/old">Old</a>\n</content>\n');
      const [error, result] = await adoptMenuItem({ rootDir: dir, id: 'old', menuName: 'Footer' });
      if(error) return fail(error.msg);
      const { menus, locations } = await list(dir);
      if(menus.length !== 1 || menus[0].name !== 'Footer' || locations.find(l => l.location === 'footer-links').menuId !== result.menuId) return fail(JSON.stringify(menus));
      if(await rendered(dir, 'footer-links') !== 'Old') return fail(await rendered(dir, 'footer-links'));
      pass('');
    });
  },

  'a link can be moved into a chosen menu': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Elsewhere', 'Home');
      await writeFile(GLOBAL(dir), (await readFile(GLOBAL(dir), 'utf8')) + '<content id="old" name="Old link" owner="custom" author="" created="" updated="" locked="false" location="footer-links" priority="4">\n<a href="/old">Old</a>\n</content>\n');
      const [error] = await adoptMenuItem({ rootDir: dir, id: 'old', menuId: id });
      if(error) return fail(error.msg);
      const { menus } = await list(dir);
      if(!menus[0].items.some(i => i.label === 'Old')) return fail(JSON.stringify(menus[0].items));
      pass('');
    });
  },

  'something that is not a plain link, belongs to an extension, or is missing cannot be moved': async ({ pass, fail }) => {
    await withSite(async dir => {
      await writeFile(GLOBAL(dir), [
        '<content id="fancy" name="Fancy" owner="custom" author="" created="" updated="" locked="false" location="main-nav-links" priority="2">\n<div>not a link</div>\n</content>',
        '<content id="ext" name="Theirs" owner="kempo-shop" author="" created="" updated="" locked="false" location="main-nav-links" priority="2">\n<a href="/s">S</a>\n</content>',
      ].join('\n') + '\n');
      const [plain] = await adoptMenuItem({ rootDir: dir, id: 'fancy' });
      const [theirs] = await adoptMenuItem({ rootDir: dir, id: 'ext' });
      const [missing] = await adoptMenuItem({ rootDir: dir, id: 'nope' });
      if(plain?.code !== 400 || theirs?.code !== 403 || missing?.code !== 404) return fail(`${plain?.code}/${theirs?.code}/${missing?.code}`);
      pass('');
    });
  },

  'a place the theme no longer has is still listed with its menu so it can be reached': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id } = await makeMenu(dir, 'Main', 'Home');
      await assignMenuLocation({ rootDir: dir, location: 'footer-links', menuId: id });
      await writeFile(path.join(dir, 'nav.fragment.html'), '<fragment></fragment>');
      const { locations, menus } = await list(dir);
      const place = locations.find(l => l.location === 'footer-links');
      if(!place || place.declared !== false || place.menuId !== id || menus.length !== 1) return fail(JSON.stringify(locations));
      const [error] = await assignMenuLocation({ rootDir: dir, location: 'footer-links', menuId: '' });
      if(error) return fail('a stale place should still be able to be cleared');
      pass('');
    });
  },

  'a locked item refuses to be edited, hidden or deleted': async ({ pass, fail }) => {
    await withSite(async dir => {
      const { id, itemIds } = await makeMenu(dir, 'Main', 'Home');
      await writeFile(GLOBAL(dir), (await readFile(GLOBAL(dir), 'utf8')).replace(/(id="[^"]*" name="Home"[^>]*?)locked="false"/, '$1locked="true"'));
      void id;
      const [edit] = await saveMenuItem({ rootDir: dir, id: itemIds[0], label: 'x', href: '/x' });
      const [hide] = await setMenuItemEnabled({ rootDir: dir, id: itemIds[0], enabled: false });
      const [remove] = await deleteMenuItems({ rootDir: dir, ids: itemIds });
      if(edit?.code !== 403 || hide?.code !== 403 || remove?.code !== 403) return fail(`${edit?.code}/${hide?.code}/${remove?.code}`);
      pass('');
    });
  },
};
