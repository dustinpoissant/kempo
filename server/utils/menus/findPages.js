import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import scanDir from '../fs/scanDir.js';
import parseFrontmatter from '../fs/parseFrontmatter.js';
import listPages from '../pages/listPages.js';
import { normalizeScopes } from '../extensions/scopes.js';

/*
  The enabled extensions that serve pages, as [{ name, root, kempo }]. Read from disk each time, as the
  router does, so what is listed is what is answering.
*/
const enabledExtensions = async () => {
  const [{ getEnabledExtensions }, { default: readKempoConfig }] = await Promise.all([
    import('../extensions/scopeCache.js'),
    import('../extensions/readKempoConfig.js'),
  ]);
  const found = [];
  for(const { name } of await getEnabledExtensions()){
    const root = join(process.cwd(), 'node_modules', name);
    try {
      found.push({ name, root, kempo: (await readKempoConfig(root)).kempo });
    } catch { /* not readable: nothing is served from it */ }
  }
  return found;
};

/* The pages an extension serves under one of its scopes, as /scope/path/. */
const pagesOfScope = async (root, { scope, dir }) => {
  const base = join(root, dir);
  return scanDir(base, base, async (fullPath, entry) => {
    if(entry.isDirectory() || !entry.name.endsWith('.page.html')) return null;
    const path = relative(base, fullPath).replace(/\\/g, '/').replace(/\.page\.html$/, '').replace(/(^|\/)index$/, '$1');
    if(path.includes('[')) return null;
    const content = await readFile(fullPath, 'utf-8');
    const meta = parseFrontmatter(content);
    if(meta.hidden === 'true') return null;
    return {
      url: `/${scope}/${path}`.replace(/\/\/+/g, '/'),
      title: meta.title || content.match(/<page\s[^>]*title="([^"]*)"/)?.[1] || '',
    };
  });
};

/*
  Every page a link can go to: the site's own, then those its extensions serve under their scopes
  (/products/, /categories/, /commerce/cart/). A page with a [param] in its address has no one address and
  is left out, and so are hidden and disabled pages. The site wins when both have an address.

  `extensions` replaces what is read from disk, as [{ name, root, kempo }], for tests.
*/
export default async ({ rootDir, extensions }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const [, site] = await listPages({ rootDir, showHidden: false });
  const pages = (site?.pages ?? [])
    .filter(page => !page.disabled && !page.url.includes('['))
    .map(page => ({ url: page.url, title: page.title || page.name || page.url, owner: page.owner }));

  const seen = new Set(pages.map(page => page.url));
  for(const { name, root, kempo } of extensions ?? await enabledExtensions()){
    for(const scope of normalizeScopes(kempo)[1]){
      for(const page of (await pagesOfScope(root, scope)).sort((a, b) => a.url.localeCompare(b.url))){
        if(seen.has(page.url)) continue;
        seen.add(page.url);
        pages.push({ url: page.url, title: page.title || page.url, owner: name });
      }
    }
  }

  return [null, pages];
};
