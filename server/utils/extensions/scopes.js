/*
  The addresses an extension answers on, read from its kempo-config.json.

  An extension serves a folder of its package at an address under its scope: with the scope `products`,
  `public/index.page.html` is `/products/` and `public/api/products/GET.js` is `/products/api/products`.
  It can claim more than one scope, each serving its own folder:

    "public-scope": "products",                              // shorthand for "products": "public"
    "public-scopes": { "categories": "public-categories" }   // /categories/ serves public-categories/

  `aliases` give pages under a scope a second, shorter address (see aliases.js). Every scope and every
  alias address is a *claim*: no two enabled extensions may claim the same address, or one inside the
  other, because the router can only give an address to one of them (see claims.js).
*/

const NAME = /^[a-z0-9][a-z0-9_-]*$/;

/* What kempo itself serves at the top level of the site. */
export const RESERVED_SCOPES = ['admin', 'api', 'kempo', 'kempo-css', 'kempo-ui', 'monaco-editor'];

const cleanDir = dir => String(dir).replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '');

const badDir = dir => !dir || dir.startsWith('/') || /^[a-z]:/i.test(dir) || dir.split('/').some(part => part === '..' || part === '');

/*
  The scopes an extension declares, each with the folder of its package it serves: [error, [{ scope, dir }]].
  An extension with no scope gets an empty list. A bad name, a reserved one, a folder that leaves the
  package, or the same scope pointed at two folders is an error.
*/
export const normalizeScopes = kempo => {
  const found = new Map();

  const add = (scope, folder) => {
    if(typeof scope !== 'string' || !NAME.test(scope)){
      return { code: 400, msg: `Scope "${scope}" must be lowercase letters, numbers, dashes or underscores, such as "products"` };
    }
    if(RESERVED_SCOPES.includes(scope)){
      return { code: 400, msg: `Scope "${scope}" is used by kempo itself` };
    }
    const dir = cleanDir(folder);
    if(typeof folder !== 'string' || badDir(dir)){
      return { code: 400, msg: `The folder for scope "${scope}" must be a folder inside the package, such as "public"` };
    }
    if(found.has(scope) && found.get(scope) !== dir){
      return { code: 400, msg: `Scope "${scope}" is given two different folders` };
    }
    found.set(scope, dir);
    return null;
  };

  const single = kempo?.['public-scope'];
  if(single !== undefined && single !== null && single !== ''){
    const error = add(single, 'public');
    if(error) return [error, null];
  }

  const several = kempo?.['public-scopes'];
  if(several !== undefined && several !== null){
    if(typeof several !== 'object' || Array.isArray(several)){
      return [{ code: 400, msg: 'public-scopes must be an object of scope to folder' }, null];
    }
    for(const [scope, folder] of Object.entries(several)){
      const error = add(scope, folder);
      if(error) return [error, null];
    }
  }

  return [null, [...found].map(([scope, dir]) => ({ scope, dir }))];
};

/* Just the scope names, for what only needs to know them (an alias must point inside one). */
export const scopeNames = kempo => (normalizeScopes(kempo)[1] ?? []).map(({ scope }) => scope);
