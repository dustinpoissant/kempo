import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  Installing an extension on a running site must not need a restart. The site owner installs from the admin, and the
  extension's pages, API routes, hooks, permissions and settings have to be there on the next request.

  This test is that site: one process, with the router built and every cache warmed by a first look at the
  extension's addresses and hook, *before* the extension exists. Then it installs the extension through the same
  function the admin's install route calls, and looks again without rebuilding the router or clearing anything by hand.
  Uninstalling must take it all away just as promptly.

  The second test pins down the one thing that does need a restart, so it is written down rather than discovered: a
  route file is read afresh on each request, but a module that route file imports is loaded once per process, so a
  changed helper only takes effect when the process is restarted. That is a matter for updating the code of an
  extension that is already running, not for adding one.

  Needs a database (see scripts/run-tests.js for the tiers); without one the suite reports itself as skipped.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { extension, permission, setting, hook } = await load('server/db/schema.js');
const databaseReachable = await reachable(db);

const NAME = 'kempo-live-fixture';
const SCOPE = 'livefixture';

const write = async (files) => {
  const dir = path.join(root, 'node_modules', NAME);
  await rm(dir, { recursive: true, force: true });
  for(const [file, content] of Object.entries(files)){
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), content);
  }
};

const rewrite = (file, content) => writeFile(path.join(root, 'node_modules', NAME, file), content);

const fixture = (kempo, extra = {}) => write({
  'package.json': JSON.stringify({ name: NAME, version: '1.0.0', type: 'module' }),
  'kempo-config.json': JSON.stringify(kempo),
  ...extra,
});

const cleanup = async () => {
  await db.delete(extension).where(eq(extension.name, NAME)).catch(() => {});
  await db.delete(hook).where(eq(hook.owner, NAME)).catch(() => {});
  await rm(path.join(root, 'node_modules', NAME), { recursive: true, force: true });
  delete globalThis.liveFixturePings;
  (await load('server/utils/extensions/scopeCache.js')).invalidateScopeCache();
  (await load('server/utils/hooks/triggerHook.js')).clearHandlerCache();
};

const mockReq = url => ({ url, path: url.split('?')[0], method: 'GET', headers: {}, cookies: {}, query: {}, body: null });

const mockRes = () => {
  const chunks = [];
  return {
    statusCode: null,
    writeHead(code){ this.statusCode = code; },
    status(code){ this.statusCode = code; return this; },
    setHeader(){},
    json(body){ this.statusCode ||= 200; chunks.push(Buffer.from(JSON.stringify(body))); },
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

/* The router a running site has: built once, before the extension exists. */
const startSite = async () => {
  const ticker = process.env.KEMPO_SCHEDULER;
  process.env.KEMPO_SCHEDULER = 'off';
  const middleware = (await load('middleware/kempo.js')).default({ rootPath: path.join(root, 'tests', 'no-such-site') });
  if(ticker === undefined) delete process.env.KEMPO_SCHEDULER; else process.env.KEMPO_SCHEDULER = ticker;
  return middleware;
};

const ping = async tag => (await load('server/utils/hooks/triggerHook.js')).default('live-fixture:ping', { tag });

const real = {
  'an extension installed on a running site is there at once: its page, API route, hook, permission and setting, and gone again when it is uninstalled': async ({ pass, fail }) => {
    try {
      await cleanup();
      await fixture({
        'public-scope': SCOPE,
        hooks: { 'live-fixture:ping': './hooks/ping.js' },
        permissions: [{ name: 'live-fixture:use', description: 'Use the live fixture' }],
        settings: [{ name: 'greeting', value: 'hello', type: 'string', description: 'A greeting' }],
      }, {
        'public/hello.txt': 'hello from the fixture',
        'public/api/ping/GET.js': 'export default async (request, response) => response.json({ pong: true });\n',
        'hooks/ping.js': 'export default data => { (globalThis.liveFixturePings ||= []).push(data.tag); };\n',
      });

      /* The running site, with every cache warmed by looking at what is not there yet. */
      const middleware = await startSite();
      const before = {
        page: await route(middleware, `/${SCOPE}/hello.txt`),
        api: await route(middleware, `/${SCOPE}/api/ping`),
      };
      await ping('before');
      if(before.page.body || !before.page.passedOn) return fail(`the page existed before the install: ${JSON.stringify(before.page)}`);
      if(before.api.body || !before.api.passedOn) return fail(`the API route existed before the install: ${JSON.stringify(before.api)}`);
      if(globalThis.liveFixturePings?.length) return fail('the hook fired before the install');

      /* Install it the way the admin does, then look again. The router is not rebuilt and no cache is cleared here. */
      const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
      const [installError] = await installExtension({ name: NAME });
      if(installError) return fail(`install: ${installError.msg}`);

      const page = await route(middleware, `/${SCOPE}/hello.txt`);
      if(page.body !== 'hello from the fixture') return fail(`the page was not served after the install: ${JSON.stringify(page)}`);

      const api = await route(middleware, `/${SCOPE}/api/ping`);
      if(api.status !== 200 || api.body !== '{"pong":true}') return fail(`the API route did not answer after the install: ${JSON.stringify(api)}`);

      await ping('after');
      if(JSON.stringify(globalThis.liveFixturePings) !== '["after"]') return fail(`the hook did not fire after the install: ${JSON.stringify(globalThis.liveFixturePings)}`);

      const [perm] = await db.select().from(permission).where(eq(permission.name, 'live-fixture:use'));
      if(perm?.owner !== NAME) return fail('the permission is missing');
      const [greeting] = await db.select().from(setting).where(eq(setting.name, `${NAME}:greeting`));
      if(!greeting) return fail('the setting is missing');

      /* And away again, just as promptly. */
      const uninstallExtension = (await load('server/utils/extensions/uninstallExtension.js')).default;
      const [uninstallError] = await uninstallExtension({ name: NAME });
      if(uninstallError) return fail(`uninstall: ${uninstallError.msg}`);

      const gone = await route(middleware, `/${SCOPE}/hello.txt`);
      if(gone.body || !gone.passedOn) return fail(`the page is still served after the uninstall: ${JSON.stringify(gone)}`);
      await ping('removed');
      if(JSON.stringify(globalThis.liveFixturePings) !== '["after"]') return fail(`the hook still fires after the uninstall: ${JSON.stringify(globalThis.liveFixturePings)}`);
      pass('');
    } finally {
      await cleanup();
    }
  },

  'a route file is read afresh on every request, but a module it imports is loaded once: the one case that needs a restart': async ({ pass, fail }) => {
    try {
      await cleanup();
      await fixture({ 'public-scope': SCOPE }, {
        'helper.js': 'export default \'one\';\n',
        'public/api/value/GET.js': 'import helper from \'../../../helper.js\';\nexport default async (request, response) => response.json({ helper, route: \'first\' });\n',
      });
      const installExtension = (await load('server/utils/extensions/installExtension.js')).default;
      const [installError] = await installExtension({ name: NAME });
      if(installError) return fail(`install: ${installError.msg}`);

      const middleware = await startSite();
      const first = JSON.parse((await route(middleware, `/${SCOPE}/api/value`)).body);
      if(first.helper !== 'one' || first.route !== 'first') return fail(`first request: ${JSON.stringify(first)}`);

      /* Change the extension's code on disk while the site runs. */
      await rewrite('helper.js', 'export default \'two\';\n');
      await rewrite('public/api/value/GET.js', 'import helper from \'../../../helper.js\';\nexport default async (request, response) => response.json({ helper, route: \'second\' });\n');

      const second = JSON.parse((await route(middleware, `/${SCOPE}/api/value`)).body);
      if(second.route !== 'second') return fail(`the route file was not read afresh: ${JSON.stringify(second)}`);
      if(second.helper !== 'one') return fail(`the helper changed without a restart, so this test no longer describes how it works: ${JSON.stringify(second)}`);
      pass('');
    } finally {
      await cleanup();
    }
  },
};

const skipped = { 'extension live install against a database (SKIPPED)': async ({ pass }) => pass('skipped: no database is reachable') };

export default databaseReachable ? real : skipped;
