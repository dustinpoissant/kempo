import { join } from 'path';
import { stat } from 'fs/promises';
import { scopeNames } from './scopes.js';

/*
  Aliases let an extension answer on a short, familiar address instead of only under its public scope:
  an extension with the scope `commerce` can declare `"aliases": { "/cart": "/commerce/cart" }` and its
  cart page is then reachable at /cart/ too. The address stays as typed (it is a rewrite, not a redirect).

  An alias must point inside one of the extension's own scopes, so an extension can only ever give a
  second address to its own pages. It never shadows a page the site has of its own at that address, and
  it cannot take over anything under /admin or /api. The alias address is a claim, like a scope, and no
  other enabled extension may claim it (see claims.js).
*/

const RESERVED = /^\/(admin|api|kempo|kempo-css|kempo-ui)(\/|$)/;

const trim = value => String(value).replace(/\/+$/, '');

/*
  Checks the `aliases` an extension declares: { "/from": "/scope/to" }. `scope` is the extension's
  scope, or the list of its scopes. Returns [error, aliases].
*/
export const normalizeAliases = (aliases, scope) => {
  const scopes = [scope].flat().filter(Boolean);
  if(aliases === undefined || aliases === null) return [null, {}];
  if(typeof aliases !== 'object' || Array.isArray(aliases)) return [{ code: 400, msg: 'aliases must be an object of address to address' }, null];

  const result = {};
  for(const [from, to] of Object.entries(aliases)){
    const source = trim(from);
    const target = trim(to);
    if(!source.startsWith('/') || source === '' || RESERVED.test(source)) return [{ code: 400, msg: `Alias "${from}" must be an address such as /cart, outside /admin and /api` }, null];
    if(!scopes.some(name => target === `/${name}` || target.startsWith(`/${name}/`))) return [{ code: 400, msg: `Alias "${from}" must point inside the extension's own scope (/${scopes.join(', /') || '…'}/…)` }, null];
    result[source] = target;
  }
  return [null, result];
};

/* True when the site itself has a page, directory or file at this address, which always wins over an alias. */
const siteHasPath = async (publicDir, address) => {
  const base = join(publicDir, ...address.split('/').filter(Boolean));
  const candidates = [base, `${base}.page.html`, `${base}.html`, join(base, 'index.page.html'), join(base, 'index.html'), join(base, 'index.js'), join(base, 'GET.js')];
  for(const candidate of candidates){
    try {
      const info = await stat(candidate);
      if(candidate === base ? info.isFile() : true) return true;
    } catch { /* not there */ }
  }
  return false;
};

/*
  The address to serve for `url`: the alias target when an enabled extension declares one for it and
  the site has no page there, otherwise `url` unchanged. `loaded` is [{ kempo }] for the enabled extensions.
*/
export const resolveAlias = async (url, loaded, publicDir) => {
  const clean = trim(url) || '/';
  for(const { kempo } of loaded){
    const scopes = scopeNames(kempo);
    if(!scopes.length || !kempo.aliases) continue;
    const [error, aliases] = normalizeAliases(kempo.aliases, scopes);
    if(error) continue;
    for(const [from, to] of Object.entries(aliases)){
      if(clean !== from && !clean.startsWith(`${from}/`)) continue;
      if(await siteHasPath(publicDir, from)) return url;
      return to + url.slice(from.length);
    }
  }
  return url;
};
