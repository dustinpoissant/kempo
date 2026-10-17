import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  An extension can claim more than one scope, each serving its own folder, and no two enabled extensions
  may claim the same address or one inside the other: the router can give an address to only one of them,
  and the loser's pages, scripts and API routes would answer 404 with no error anywhere.

  The first half is the rules, with no database. The second drives the real install, enable and routing
  with fixture extensions written into node_modules and removed afterwards.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const { normalizeScopes, scopeNames, RESERVED_SCOPES } = await load('server/utils/extensions/scopes.js');
const { normalizeAliases, resolveAlias } = await load('server/utils/extensions/aliases.js');
const { claimsOf, findClaimConflicts, overlaps, describeConflict } = await load('server/utils/extensions/claims.js');

const db = (await load('server/db/index.js')).default;
const { extension } = await load('server/db/schema.js');
const databaseReachable = await reachable(db);

const config = kempo => ({ kempo });

const pure = {
  'one scope serves public/, as before': async ({ pass, fail }) => {
    const [error, scopes] = normalizeScopes({ 'public-scope': 'products' });
    if(error || JSON.stringify(scopes) !== JSON.stringify([{ scope: 'products', dir: 'public' }])) return fail(JSON.stringify([error, scopes]));
    pass('');
  },

  'several scopes each serve their own folder, alongside public-scope': async ({ pass, fail }) => {
    const [error, scopes] = normalizeScopes({ 'public-scope': 'products', 'public-scopes': { categories: 'public-categories', 'sales-2': './web/sales/' } });
    const got = JSON.stringify(scopes);
    if(error || got !== JSON.stringify([{ scope: 'products', dir: 'public' }, { scope: 'categories', dir: 'public-categories' }, { scope: 'sales-2', dir: 'web/sales' }])) return fail(got);
    pass('');
  },

  'an extension with no scope claims nothing': async ({ pass, fail }) => {
    const [error, scopes] = normalizeScopes({});
    if(error || scopes.length) return fail(JSON.stringify([error, scopes]));
    if(claimsOf({}).length) return fail('claims from nothing');
    pass('');
  },

  'a bad scope, a reserved one or a folder outside the package is refused': async ({ pass, fail }) => {
    const bad = [
      { 'public-scope': 'Products' },
      { 'public-scope': 'a/b' },
      { 'public-scope': 'with space' },
      ...RESERVED_SCOPES.map(scope => ({ 'public-scope': scope })),
      { 'public-scopes': { x: '../outside' } },
      { 'public-scopes': { x: '/etc' } },
      { 'public-scopes': { x: 'C:/windows' } },
      { 'public-scopes': { x: 'a/../../b' } },
      { 'public-scopes': { x: '' } },
      { 'public-scopes': { x: 7 } },
      { 'public-scopes': ['x'] },
      { 'public-scopes': 'x' },
      { 'public-scope': 'x', 'public-scopes': { x: 'other' } },
    ];
    for(const kempo of bad){
      const [error] = normalizeScopes(kempo);
      if(error?.code !== 400) return fail(`accepted ${JSON.stringify(kempo)}`);
    }
    pass('');
  },

  'naming the same scope twice with the same folder is fine': async ({ pass, fail }) => {
    const [error, scopes] = normalizeScopes({ 'public-scope': 'x', 'public-scopes': { x: 'public/' } });
    if(error || scopes.length !== 1) return fail(JSON.stringify([error, scopes]));
    pass('');
  },

  'an alias may point into any of the extension\'s scopes, and only those': async ({ pass, fail }) => {
    const [error, ok] = normalizeAliases({ '/cart': '/shop/cart', '/c': '/categories/all' }, ['shop', 'categories']);
    if(error || ok['/cart'] !== '/shop/cart' || ok['/c'] !== '/categories/all') return fail(JSON.stringify([error, ok]));
    const [refused] = normalizeAliases({ '/x': '/elsewhere/x' }, ['shop', 'categories']);
    if(refused?.code !== 400) return fail('an alias outside every scope was accepted');
    const [single] = normalizeAliases({ '/cart': '/shop/cart' }, 'shop');
    if(single) return fail('the one-scope form stopped working');
    pass('');
  },

  'an alias into the second scope is rewritten': async ({ pass, fail }) => {
    const shop = config({ 'public-scope': 'shop', 'public-scopes': { categories: 'public-categories' }, aliases: { '/browse': '/categories/all' } });
    const got = await resolveAlias('/browse/x', [shop], path.join(root, 'tests', 'no-such-site'));
    if(got !== '/categories/all/x') return fail(got);
    pass('');
  },

  'an address collides with itself or anything inside it, but not a name that merely starts the same': async ({ pass, fail }) => {
    const cases = [
      ['/products', '/products', true],
      ['/products', '/products/x', true],
      ['/products/x', '/products', true],
      ['/products', '/products-inventory', false],
      ['/products', '/product', false],
      ['/a/b', '/a/c', false],
    ];
    for(const [a, b, expected] of cases){
      if(overlaps(a, b) !== expected) return fail(`${a} vs ${b} should be ${expected}`);
    }
    pass('');
  },

  'every scope and every alias is a claim': async ({ pass, fail }) => {
    const claims = claimsOf({ 'public-scope': 'commerce', 'public-scopes': { categories: 'cats' }, aliases: { '/cart': '/commerce/cart', '/account/orders': '/commerce/orders' } });
    if(claims.join() !== '/commerce,/categories,/cart,/account/orders') return fail(claims.join());
    pass('');
  },

  'two extensions claiming one scope collide, and the second scope counts too': async ({ pass, fail }) => {
    const a = { name: 'kempo-a', kempo: { 'public-scope': 'shop' } };
    const b = { name: 'kempo-b', kempo: { 'public-scope': 'blog', 'public-scopes': { shop: 'public-shop' } } };
    const conflicts = findClaimConflicts([b], [a]);
    if(conflicts.length !== 1 || conflicts[0].other !== 'kempo-a' || conflicts[0].claim !== '/shop') return fail(JSON.stringify(conflicts));
    pass('');
  },

  'an alias that lands inside another extension\'s scope collides': async ({ pass, fail }) => {
    const a = { name: 'kempo-a', kempo: { 'public-scope': 'cart' } };
    const b = { name: 'kempo-b', kempo: { 'public-scope': 'shop', aliases: { '/cart': '/shop/cart' } } };
    if(findClaimConflicts([b], [a]).length !== 1) return fail('an alias over another extension\'s scope was not caught');
    const c = { name: 'kempo-c', kempo: { 'public-scope': 'x', aliases: { '/cart/summary': '/x/s' } } };
    if(findClaimConflicts([c], [a]).length !== 1) return fail('an alias inside another extension\'s scope was not caught');
    pass('');
  },

  'an extension never collides with itself, even with a scope and aliases that sit inside each other': async ({ pass, fail }) => {
    const a = { name: 'kempo-a', kempo: { 'public-scope': 'shop', 'public-scopes': { cats: 'c' }, aliases: { '/cats/all': '/shop/all', '/shop-x': '/cats/x' } } };
    if(findClaimConflicts([a], [a]).length) return fail('it collided with its own copy');
    pass('');
  },

  'candidates installed together are checked against each other': async ({ pass, fail }) => {
    const a = { name: 'kempo-a', kempo: { 'public-scope': 'one' } };
    const b = { name: 'kempo-b', kempo: { 'public-scopes': { one: 'x' } } };
    if(findClaimConflicts([a, b], []).length !== 1) return fail('two things switched on at once were not compared');
    pass('');
  },

  'the message names who holds the address and what to do': async ({ pass, fail }) => {
    const text = describeConflict({ name: 'kempo-b', claim: '/shop', other: 'kempo-a', otherClaim: '/shop' }, 'install');
    if(text !== 'Cannot install kempo-b: kempo-a already uses /shop. Disable or uninstall kempo-a first.') return fail(text);
    const nested = describeConflict({ name: 'kempo-b', claim: '/shop/x', other: 'kempo-a', otherClaim: '/shop' }, 'enable');
    if(!nested.includes('/shop, which overlaps /shop/x')) return fail(nested);
    pass('');
  },

  'scopeNames lists every scope, and the declaration kempo-products uses is valid': async ({ pass, fail }) => {
    const [error] = normalizeScopes({ 'public-scope': 'products', 'public-scopes': { categories: 'public-categories' } });
    if(error || scopeNames({ 'public-scope': 'a', 'public-scopes': { b: 'x' } }).join() !== 'a,b') return fail('scopeNames');
    pass('');
  },
};

/*
  Fixture extensions, written where kempo reads them (node_modules) and removed afterwards.
*/
const FIXTURES = ['kempo-scope-fixture-a', 'kempo-scope-fixture-b', 'kempo-scope-fixture-c'];

const write = async (name, files) => {
  const dir = path.join(root, 'node_modules', name);
  await rm(dir, { recursive: true, force: true });
  for(const [file, content] of Object.entries(files)){
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), content);
  }
};

const makePackage = (name, kempo, extra = {}) => write(name, {
  'package.json': JSON.stringify({ name, version: '1.0.0', type: 'module' }),
  'kempo-config.json': JSON.stringify(kempo),
  ...extra,
});

const cleanup = async () => {
  await db.delete(extension).where(inArray(extension.name, FIXTURES)).catch(() => {});
  for(const name of FIXTURES) await rm(path.join(root, 'node_modules', name), { recursive: true, force: true });
  const { invalidateScopeCache } = await load('server/utils/extensions/scopeCache.js');
  invalidateScopeCache();
};

const mockReq = url => ({ url, path: url.split('?')[0], method: 'GET', headers: {}, cookies: {} });

const mockRes = () => {
  const chunks = [];
  return {
    statusCode: null,
    writeHead(code){ this.statusCode = code; },
    setHeader(){},
    write(chunk){ if(chunk) chunks.push(Buffer.from(chunk)); return true; },
    end(chunk){ if(chunk) chunks.push(Buffer.from(chunk)); },
    getBody: () => Buffer.concat(chunks).toString('utf8'),
  };
};

const route = async (middleware, url) => {
  const res = mockRes();
  let passedOn = false;
  await middleware(mockReq(url), res, () => { passedOn = true; });
  return { status: res.statusCode, body: res.getBody(), passedOn };
};

const real = {
  'the router serves each scope from its own folder, and an alias into the second one': async ({ pass, fail }) => {
    try {
      await makePackage(FIXTURES[0], { 'public-scope': 'scopea', 'public-scopes': { scopeb: 'web-b' }, aliases: { '/short': '/scopeb/hello.txt' } }, {
        'public/hello.txt': 'from a',
        'web-b/hello.txt': 'from b',
      });
      const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
      const [installError] = await installExtension({ name: FIXTURES[0] });
      if(installError) return fail(`install: ${installError.msg}`);

      /* Creating the middleware starts the job ticker, which this test has no use for and must not leave on for the others. */
      const ticker = process.env.KEMPO_SCHEDULER;
      process.env.KEMPO_SCHEDULER = 'off';
      const middleware = (await load('middleware/kempo.js')).default({ rootPath: path.join(root, 'tests', 'no-such-site') });
      if(ticker === undefined) delete process.env.KEMPO_SCHEDULER; else process.env.KEMPO_SCHEDULER = ticker;

      const a = await route(middleware, '/scopea/hello.txt');
      const b = await route(middleware, '/scopeb/hello.txt');
      const alias = await route(middleware, '/short');
      const none = await route(middleware, '/scopec/hello.txt');

      if(a.body !== 'from a') return fail(`first scope: ${JSON.stringify(a)}`);
      if(b.body !== 'from b') return fail(`second scope: ${JSON.stringify(b)}`);
      if(alias.body !== 'from b') return fail(`alias: ${JSON.stringify(alias)}`);
      if(none.body || !none.passedOn) return fail(`an unclaimed scope should fall through: ${JSON.stringify(none)}`);
      pass('');
    } finally {
      await cleanup();
    }
  },

  'installing a second extension that claims an address already in use is refused, naming the first': async ({ pass, fail }) => {
    try {
      const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
      await makePackage(FIXTURES[0], { 'public-scope': 'clash' });
      await makePackage(FIXTURES[1], { 'public-scopes': { other: 'public', clash: 'public-clash' } });
      const [first] = await installExtension({ name: FIXTURES[0] });
      if(first) return fail(`first install: ${first.msg}`);

      const [refused, result] = await installExtension({ name: FIXTURES[1] });
      if(refused?.code !== 409 || result) return fail(`expected a 409: ${JSON.stringify(refused)}`);
      if(!refused.msg.includes(FIXTURES[0]) || !refused.msg.includes('/clash') || !/Disable or uninstall/.test(refused.msg)) return fail(refused.msg);

      const rows = await db.select().from(extension).where(eq(extension.name, FIXTURES[1]));
      if(rows.length) return fail('a refused install left a row behind');
      pass('');
    } finally {
      await cleanup();
    }
  },

  'an address inside another extension\'s scope is refused too': async ({ pass, fail }) => {
    try {
      const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
      await makePackage(FIXTURES[0], { 'public-scope': 'shop' });
      await makePackage(FIXTURES[1], { 'public-scope': 'cart', aliases: { '/shop/cart': '/cart/x' } });
      await installExtension({ name: FIXTURES[0] });
      const [refused] = await installExtension({ name: FIXTURES[1] });
      if(refused?.code !== 409 || !refused.msg.includes('overlaps')) return fail(JSON.stringify(refused));
      pass('');
    } finally {
      await cleanup();
    }
  },

  'once the first is disabled the second installs, and the first can no longer be enabled': async ({ pass, fail }) => {
    try {
      const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
      const disableExtension = (await load('server/utils/extensions/disableExtension.js')).default;
      const enableExtension = (await load('server/utils/extensions/enableExtension.js')).default;
      await makePackage(FIXTURES[0], { 'public-scope': 'clash' });
      await makePackage(FIXTURES[1], { 'public-scope': 'clash' });

      await installExtension({ name: FIXTURES[0] });
      const [disabled] = await disableExtension({ name: FIXTURES[0] });
      if(disabled) return fail(`disable: ${disabled.msg}`);

      const [second] = await installExtension({ name: FIXTURES[1] });
      if(second) return fail(`the second should install once the first is off: ${second.msg}`);

      const [refused] = await enableExtension({ name: FIXTURES[0] });
      if(refused?.code !== 409 || !refused.msg.includes(FIXTURES[1]) || !refused.msg.startsWith('Cannot enable')) return fail(`enable: ${JSON.stringify(refused)}`);
      const [stillOff] = await db.select().from(extension).where(eq(extension.name, FIXTURES[0]));
      if(stillOff.enabled) return fail('a refused enable still switched it on');

      await disableExtension({ name: FIXTURES[1] });
      const [enabled] = await enableExtension({ name: FIXTURES[0] });
      if(enabled) return fail(`with the other off it should enable: ${enabled.msg}`);
      pass('');
    } finally {
      await cleanup();
    }
  },

  'extensions with different scopes install side by side, and a scope that only starts the same is not a collision': async ({ pass, fail }) => {
    try {
      const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
      await makePackage(FIXTURES[0], { 'public-scope': 'products' });
      await makePackage(FIXTURES[1], { 'public-scope': 'products-inventory' });
      await makePackage(FIXTURES[2], { 'public-scope': 'blog', 'public-scopes': { categories: 'public-categories' } });
      for(const name of FIXTURES){
        const [error] = await installExtension({ name });
        if(error) return fail(`${name}: ${error.msg}`);
      }
      pass('');
    } finally {
      await cleanup();
    }
  },

  'an invalid scope is refused at install, before anything is written': async ({ pass, fail }) => {
    try {
      const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
      await makePackage(FIXTURES[0], { 'public-scopes': { good: 'public', bad: '../elsewhere' } });
      const [refused] = await installExtension({ name: FIXTURES[0] });
      if(refused?.code !== 400) return fail(JSON.stringify(refused));
      const rows = await db.select().from(extension).where(eq(extension.name, FIXTURES[0]));
      if(rows.length) return fail('an invalid scope left a row');
      pass('');
    } finally {
      await cleanup();
    }
  },
};

const skipped = { 'extension scopes against a database (SKIPPED)': async ({ pass }) => pass('skipped: no database is reachable') };

export default { ...pure, ...(databaseReachable ? real : skipped) };
