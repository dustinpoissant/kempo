import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  An extension can declare `aliases` in kempo-config.json so its pages answer on a short address
  (`/cart` for `/commerce/cart`). The alias stays inside the extension's scope, never shadows a page
  the site has, and cannot touch /admin or /api.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { normalizeAliases, resolveAlias } = await import(pathToFileURL(path.join(root, 'server/utils/extensions/aliases.js')).href);

const commerce = { kempo: { 'public-scope': 'commerce', aliases: { '/cart': '/commerce/cart', '/account/orders': '/commerce/account/orders/' } } };

export default {
  'aliases are validated': async ({ pass, fail }) => {
    const [error, ok] = normalizeAliases({ '/cart/': '/commerce/cart/' }, 'commerce');
    if(error || ok['/cart'] !== '/commerce/cart') return fail('a good alias was refused or not normalised');
    const bad = [
      [{ '/admin/x': '/commerce/x' }, 'commerce'],
      [{ '/api': '/commerce/x' }, 'commerce'],
      [{ cart: '/commerce/cart' }, 'commerce'],
      [{ '/cart': '/elsewhere/cart' }, 'commerce'],
      [{ '/cart': '/commerce-other/cart' }, 'commerce'],
      [{ '/cart': '/commerce/cart' }, undefined],
      [['/cart'], 'commerce'],
    ];
    for(const [aliases, scope] of bad){
      const [refused] = normalizeAliases(aliases, scope);
      if(!refused || refused.code !== 400) return fail(`accepted ${JSON.stringify(aliases)} for ${scope}`);
    }
    pass('');
  },

  'an alias rewrites its address and everything under it, keeping the trailing slash': async ({ pass, fail }) => {
    const site = await mkdtemp(path.join(tmpdir(), 'kempo-alias-'));
    try {
      const cases = [
        ['/cart', '/commerce/cart'],
        ['/cart/', '/commerce/cart/'],
        ['/cart/extra/file.js', '/commerce/cart/extra/file.js'],
        ['/account/orders/', '/commerce/account/orders/'],
        ['/account/orders/abc', '/commerce/account/orders/abc'],
        ['/carts', '/carts'],
        ['/cartoon/', '/cartoon/'],
        ['/account/', '/account/'],
        ['/', '/'],
      ];
      for(const [url, expected] of cases){
        const got = await resolveAlias(url, [commerce], site);
        if(got !== expected) return fail(`${url} -> ${got}, expected ${expected}`);
      }
      pass('');
    } finally {
      await rm(site, { recursive: true, force: true });
    }
  },

  'a page the site has of its own wins over an alias': async ({ pass, fail }) => {
    const site = await mkdtemp(path.join(tmpdir(), 'kempo-alias-'));
    try {
      await mkdir(path.join(site, 'cart'), { recursive: true });
      await writeFile(path.join(site, 'cart', 'index.page.html'), '<page><content>mine</content></page>');
      if(await resolveAlias('/cart/', [commerce], site) !== '/cart/') return fail('the site\'s directory page was shadowed');
      await writeFile(path.join(site, 'account.page.html'), '<page><content>mine</content></page>');
      await mkdir(path.join(site, 'account', 'orders'), { recursive: true });
      if(await resolveAlias('/account/orders/', [commerce], site) !== '/commerce/account/orders/') return fail('an unrelated site page blocked the alias');
      await writeFile(path.join(site, 'account', 'orders', 'index.html'), 'mine');
      if(await resolveAlias('/account/orders/', [commerce], site) !== '/account/orders/') return fail('the site\'s page was shadowed');
      pass('');
    } finally {
      await rm(site, { recursive: true, force: true });
    }
  },

  'an invalid alias in an installed extension is ignored, not served': async ({ pass, fail }) => {
    const site = await mkdtemp(path.join(tmpdir(), 'kempo-alias-'));
    try {
      const evil = { kempo: { 'public-scope': 'evil', aliases: { '/admin/users': '/evil/x', '/login': '/elsewhere/login' } } };
      if(await resolveAlias('/admin/users', [evil], site) !== '/admin/users') return fail('an alias took over /admin');
      if(await resolveAlias('/login', [evil], site) !== '/login') return fail('an alias escaped its scope');
      pass('');
    } finally {
      await rm(site, { recursive: true, force: true });
    }
  },
};
