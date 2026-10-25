import { dirname, join, extname, isAbsolute, resolve } from 'path';
import { readFile, stat, readdir } from 'fs/promises';
import { pathToFileURL, fileURLToPath } from 'url';
import { renderExternalPage } from 'kempo-server/templating';
import getSession from '../server/utils/auth/getSession.js';
import currentUserHasPermission from '../server/utils/permissions/currentUserHasPermission.js';
import { LEXICAL_BASE, bundleFileName as lexicalBundleFileName } from '../server/utils/lexical/packages.js';
import { getEnabledExtensions, onExtensionsChanged } from '../server/utils/extensions/scopeCache.js';
import { resyncMenus } from '../server/utils/menus/store.js';
import readKempoConfig from '../server/utils/extensions/readKempoConfig.js';
import { extensionAdminDirs, extensionPublicDirs } from '../server/utils/extensions/contentDirs.js';
import triggerHook from '../server/utils/hooks/triggerHook.js';
import { ADMIN_GLOBALS_DIR } from '../server/utils/admin-global-content/helpers.js';
import { startScheduler } from '../server/utils/scheduler/scheduler.js';
import { ensureEncryptionKey } from '../server/utils/settings/ensureEncryptionKey.js';
import syncCoreSchema from '../server/utils/setup/syncCoreSchema.js';
import runUpgrades from '../server/utils/setup/runUpgrades.js';
import seedIfNew from '../server/utils/setup/seedIfNew.js';
import reconcileExtensions from '../server/utils/extensions/reconcileExtensions.js';
import { flagFailed, markHealthy } from '../server/utils/updates/siteLayout.js';
import notifySchemaAttention from '../server/utils/updates/notifySchemaAttention.js';
import { ensureSystemSettings } from '../server/utils/settings/systemSettings.js';
import { ensureSystemPermissions } from '../server/utils/setup/systemPermissions.js';
import registerJobs from '../server/utils/scheduler/registerJobs.js';
import '../server/utils/updates/runtime.js';
import { resolveAlias } from '../server/utils/extensions/aliases.js';
import { normalizeScopes } from '../server/utils/extensions/scopes.js';

const MIME_TYPES = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const ROUTE_FILES = ['GET.js','POST.js','PUT.js','DELETE.js','PATCH.js','HEAD.js','OPTIONS.js','index.js','CATCH.js'];

const NODE_MODULES = join(process.cwd(), 'node_modules');

/*
  Admin portal source. Defaults to dist/admin relative to this file, which works both in this repo
  and as a consumer dependency. Set `middleware.adminRoot` in the server config (resolved from cwd)
  to point at src/admin instead, so admin pages can be edited without rebuilding.
*/
const DEFAULT_ADMIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'admin');

/*
  Where the lexical bundles live and the URL they are served at. Must stay in step with
  window.kempo.lexicalUrl in src/admin/init.js, which is what kempo-ui reads.
*/
const LEXICAL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'kempo', 'vendor', 'lexical');

let lexicalVersionCache = null;
const lexicalVersion = async () => {
  if(lexicalVersionCache) return lexicalVersionCache;
  try {
    const manifest = JSON.parse(await readFile(join(LEXICAL_DIR, 'manifest.json'), 'utf8'));
    lexicalVersionCache = manifest.version;
  } catch {
    lexicalVersionCache = 'unknown';
  }
  return lexicalVersionCache;
};

const resolveAdminRoot = adminRoot => {
  if(!adminRoot) return DEFAULT_ADMIN_ROOT;
  return isAbsolute(adminRoot) ? adminRoot : resolve(process.cwd(), adminRoot);
};

const buildResolveDir = (base, url) => {
  const parts = url.replace(/\/+$/, '').split('/').filter(Boolean);
  let dir = base;
  for(const part of parts) dir = join(dir, part);
  return dir;
};

const walkDynamic = async (base, segments) => {
  if(segments.length === 0) return { filePath: base, params: {} };
  const [head, ...rest] = segments;
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch { return null; }
  for(const entry of entries){
    if(entry.name !== head) continue;
    if(entry.isDirectory()){
      const result = await walkDynamic(join(base, head), rest);
      if(result) return result;
    } else if(entry.isFile() && rest.length === 0){
      return { filePath: join(base, head), params: {} };
    }
  }
  if(rest.length === 0){
    for(const entry of entries){
      if(entry.isFile() && entry.name === `${head}.page.html`){
        return { filePath: join(base, entry.name), params: {} };
      }
    }
  }
  for(const entry of entries){
    if(!entry.isDirectory() || !entry.name.startsWith('[') || !entry.name.endsWith(']')) continue;
    const paramName = entry.name.slice(1, -1);
    const result = await walkDynamic(join(base, entry.name), rest);
    if(result) return { filePath: result.filePath, params: { [paramName]: head, ...result.params } };
  }
  return null;
};

const executeRouteFile = async (filePath, request, response, params = {}) => {
  const fileUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;
  const module = await import(fileUrl);
  if(typeof module.default !== 'function') return false;
  if(params && Object.keys(params).length) request.params = { ...(request.params || {}), ...params };
  await module.default(request, response);
  return true;
};

/*
  Every .page.html render must go through here. The `middleware:before_page` hook lets extensions
  veto a render (throw `{code}` to send that status, or `{redirect}` to redirect), which is how
  extensions guard their own private pages. Rendering a page anywhere without this helper silently
  bypasses those guards.
*/
const renderGuardedPage = async (pageFilePath, request, response, rootDir, resolveDir, params = {}, extraGlobalDirs = [], extraFragmentDirs = []) => {
  try {
    await triggerHook('middleware:before_page', {
      url: request.url.split('?')[0],
      query: request.query || {},
      params,
      cookies: request.cookies || {},
    }, { bail: true });
  } catch(e) {
    if(e?.redirect) return response.redirect(e.redirect);
    response.writeHead(e?.code || 404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('');
    return;
  }

  const html = await renderExternalPage(pageFilePath, rootDir, resolveDir, {}, {}, 10, extraGlobalDirs, extraFragmentDirs);
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
};

/*
  Directories that contribute *.global.html to an admin render, on top of ADMIN_ROOT itself.

  Each enabled extension's admin/ directory is read straight from its package at render time — the
  same way its admin pages and public pages are resolved — so nothing is copied into kempo's
  dist/admin on install. Enabling, disabling, upgrading or removing an extension takes effect
  immediately, and a rebuild of kempo cannot discard it.

  Admin globals authored through the admin UI live in the consumer's project instead, since those
  are genuinely mutable and cannot live inside a package.
*/
export const adminGlobalDirs = async () => [
  ADMIN_GLOBALS_DIR,
  ...await extensionAdminDirs(),
];

/*
  Fragments an admin render may pull from extension packages. ADMIN_GLOBALS_DIR is deliberately not
  here: it holds admin-authored global content and never fragments.
*/
export const adminFragmentDirs = () => extensionAdminDirs();

const serveDir = async (dirPath, method, request, response, resolveDir, rootDir, params = {}, extraGlobalDirs = [], extraFragmentDirs = []) => {
  const candidates = [`${method}.js`, 'index.page.html', 'index.js', 'index.html', 'CATCH.js'];
  for(const candidate of candidates){
    const candidatePath = join(dirPath, candidate);
    try { await stat(candidatePath); } catch { continue; }
    if(candidate.endsWith('.page.html')){
      await renderGuardedPage(candidatePath, request, response, rootDir, resolveDir, params, extraGlobalDirs, extraFragmentDirs);
      return true;
    }
    if(ROUTE_FILES.includes(candidate)){
      return executeRouteFile(candidatePath, request, response, params);
    }
    const mime = MIME_TYPES[extname(candidatePath)] || 'text/html';
    response.writeHead(200, { 'Content-Type': mime });
    response.end(await readFile(candidatePath));
    return true;
  }
  return false;
};

export default config => {
  startScheduler();

  /* A site that runs from a Docker volume has just switched to new code: once it has stayed up a minute the switch is final. */
  if(process.env.KEMPO_SITE_ROOT && process.env.KEMPO_DB !== 'pglite'){
    setTimeout(() => markHealthy(process.env.KEMPO_SITE_ROOT), 60000).unref();
  }

  /*
    The key that encrypts stored credentials exists before any request needs it, generated into .env the
    first time when the site has none. Opt out with `autoEncryptionKey: false` in the server config or
    KEMPO_AUTO_ENCRYPTION_KEY=off, and never in the in-memory test database.
  */
  const encryptionKeyReady = config.autoEncryptionKey === false || process.env.KEMPO_AUTO_ENCRYPTION_KEY === 'off' || process.env.KEMPO_DB === 'pglite'
    ? Promise.resolve()
    : ensureEncryptionKey().then(([error]) => {
      if(error) console.error(`[kempo] ${error.msg}`);
    });
  /*
    What kempo added in a later version appears on an older site at start: its tables and columns (additive only, see syncCoreSchema), its settings (so they show on the settings screen and can be
    edited), its permissions, and its own scheduled jobs (the email retries and cleanup, and the check for a newer kempo). Only what is missing is added, and never in
    the in-memory test database (nothing is set up there yet).
  */
  const systemSettingsReady = process.env.KEMPO_DB === 'pglite'
    ? Promise.resolve()
    : (async () => {
      for(const [step, run] of [
        ['schema', async () => {
          const [error, result] = await syncCoreSchema();
          if(result?.applied.length) console.log(`[kempo] Database brought up to date: ${result.applied.join('; ')}`);
          for(const { change, reason } of result?.failed ?? []) console.error(`[kempo] Database change failed: ${change}: ${reason}`);
          return [error];
        }],
        ['seed', async () => {
          const [error, result] = await seedIfNew();
          if(result?.seeded) console.log('[kempo] New database: its groups, permissions and settings were set up. Open /setup to create the first administrator.');
          return [error];
        }],
        ['upgrades', async () => {
          const [error, result] = await runUpgrades();
          if(result?.ran.length) console.log(`[kempo] Data migrations run: ${result.ran.join(', ')}`);
          if(error){
            console.error(`[kempo] ${error.msg}`);
            if(error.breaking && process.env.KEMPO_SITE_ROOT){
              flagFailed({ siteRoot: process.env.KEMPO_SITE_ROOT, reason: error.msg });
              process.exit(1);
            }
          }
          return [null];
        }],
        ['settings', ensureSystemSettings],
        ['permissions', ensureSystemPermissions],
        ['extensions', async () => {
          const [error, result] = await reconcileExtensions();
          for(const { name, from, to } of result?.upgraded ?? []) console.log(`[kempo] Extension ${name} brought up to date: ${from} -> ${to}`);
          for(const { name, from, to } of result?.reverted ?? []) console.log(`[kempo] Extension ${name} is back on ${to} (was ${from})`);
          for(const { name, reason } of result?.failed ?? []) console.error(`[kempo] Extension ${name} could not be brought up to date: ${reason}`);
          if(result?.failed.some(item => item.major) && process.env.KEMPO_SITE_ROOT){
            flagFailed({ siteRoot: process.env.KEMPO_SITE_ROOT, reason: result.failed.filter(item => item.major).map(item => `${item.name}: ${item.reason}`).join('; ') });
            process.exit(1);
          }
          return [error];
        }],
        ['schema notice', notifySchemaAttention],
        ['jobs', () => registerJobs({ owner: 'kempo', jobs: [
          { name: 'email-maintenance', every: '1m', callback: './server/utils/email/maintainEmails.js' },
          { name: 'session-cleanup', every: '1h', callback: './server/utils/sessions/pruneExpiredSessions.js' },
          { name: 'update-check', every: '12h', callback: './server/utils/updates/runUpdateCheck.js' },
        ] })],
      ]){
        const [error] = await run();
        if(error) console.error(`[kempo] System ${step}: ${error.msg}`);
      }
    })();
  const PROJECT_PUBLIC = config.rootPath || join(process.cwd(), 'public');
  const ADMIN_ROOT = resolveAdminRoot(config.adminRoot);

  /*
    A menu holds a copy of what an extension supplied, so it is brought up to date whenever extensions are
    installed, enabled, disabled or removed: what an extension supplied leaves the site with it. Not at
    start, when the database may not be answering yet and every extension would look absent.
  */
  onExtensionsChanged(() => resyncMenus(PROJECT_PUBLIC));

  return async (request, response, next) => {
    await encryptionKeyReady;
    await systemSettingsReady;
    const { path } = request;
    const url = request.url.split('?')[0];

    /*
      Locally hosted lexical for the admin's WYSIWYG.

      kempo-ui's HtmlEditor requests `${window.kempo.lexicalUrl}/${pkg}@${version}`, an esm.sh-shaped
      URL with no file extension, so it cannot be served by a static route: the package name
      contains a slash and the response needs a JavaScript content type to be accepted as a module.
      This maps that shape onto the bundles the build produced.

      Served before the auth gate on purpose. These are public third-party assets, and requiring a
      session would make the editor fail for exactly the reader who is allowed to see it.
    */
    if(url.startsWith(`${LEXICAL_BASE}/`)){
      const requested = decodeURIComponent(url.slice(LEXICAL_BASE.length + 1));
      const match = requested.match(/^(.+)@([^@]+)$/);

      /*
        Shared chunks. Splitting puts lexical's core in a chunk that the package entries import by
        relative path, so those requests arrive here as ordinary filenames with no version suffix.
      */
      let file = null;
      if(match){
        file = join(LEXICAL_DIR, lexicalBundleFileName(match[1]));
        if(match[2] !== await lexicalVersion()){
          console.warn(`[kempo] lexical ${match[2]} requested but ${await lexicalVersion()} is bundled — rebuild kempo, or kempo-ui's LEXICAL_VERSION has moved`);
        }
      } else if(/^[\w./-]+\.js$/.test(requested) && !requested.includes('..')){
        file = join(LEXICAL_DIR, requested);
      }

      if(file){
        try {
          const info = await stat(file);
          /*
            Revalidated rather than immutable. The URL carries lexical's version but not kempo's, so
            rebuilding kempo changes what lives at the same URL, and caching that for a year would
            strand every client on a stale bundle. A 304 costs almost nothing.

            `no-cache`, not `must-revalidate` alone: without an explicit max-age, must-revalidate
            leaves freshness to the browser's heuristics, and a heuristically-fresh entry is served
            straight from disk cache with no conditional request at all — so a stale entry chunk can
            keep pointing at a chunk hash a rebuild already deleted, breaking the editor with no
            network request to observe. no-cache forces a conditional GET on every load regardless of
            heuristic freshness, so a rebuild is always picked up via the ETag check above.
          */
          const etag = `"${info.size}-${Math.floor(info.mtimeMs)}"`;
          if(request.headers['if-none-match'] === etag){
            response.writeHead(304, { ETag: etag, 'Cache-Control': 'public, no-cache' });
            response.end();
            return;
          }
          response.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, no-cache',
            ETag: etag,
          });
          response.end(await readFile(file));
          return;
        } catch {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end(`No bundled lexical asset "${requested}". Run \`npm run build\` in kempo.`);
          return;
        }
      }
    }

    /*
      Auth: protect /account and /admin routes
    */
    if(path.startsWith('/account') || path.startsWith('/admin')){
      const [error, session] = await getSession({ token: request.cookies.session_token });
      if(error || !session?.user) return response.redirect('/login');

      if(path.startsWith('/admin')){
        const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:admin:access');
        if(permError || !hasPermission) return response.redirect('/account');

        if(path.startsWith('/admin/pages/edit')){
          const [editErr, canEdit] = await currentUserHasPermission(request.cookies.session_token, 'system:pages:update');
          if(editErr || !canEdit) return response.redirect('/admin/pages');
        }
      }
    }

    /*
      Admin routing: /admin/** -> ADMIN_ROOT (dist/admin)
      Uses renderExternalPage so template walk-up starts in ADMIN_ROOT, not the consumer's public/.
    */
    if(url === '/admin' || url.startsWith('/admin/')){
      const method = request.method?.toUpperCase() || 'GET';

      // Extension admin pages handled below
      if(!url.startsWith('/admin/extension/')){
        const segments = url.slice('/admin'.length).replace(/^\//, '').split('/').filter(Boolean);
        const resolveDir = buildResolveDir(ADMIN_ROOT, url);
        const globalDirs = await adminGlobalDirs();
        const fragmentDirs = await adminFragmentDirs();

        if(segments.length === 0){
          const served = await serveDir(ADMIN_ROOT, method, request, response, resolveDir, ADMIN_ROOT, {}, globalDirs, fragmentDirs);
          if(served) return;
        } else {
          const walked = await walkDynamic(ADMIN_ROOT, segments);
          if(walked){
            const { filePath, params } = walked;
            let fileStat;
            try { fileStat = await stat(filePath); } catch { /* not found */ }

            if(fileStat?.isDirectory()){
              const served = await serveDir(filePath, method, request, response, resolveDir, ADMIN_ROOT, params, globalDirs, fragmentDirs);
              if(served) return;
            } else if(fileStat?.isFile()){
              const name = filePath.split(/[/\\]/).pop();
              if(name.endsWith('.page.html')){
                await renderGuardedPage(filePath, request, response, ADMIN_ROOT, resolveDir, params, globalDirs, fragmentDirs);
                return;
              }
              if(ROUTE_FILES.includes(name)){
                await executeRouteFile(filePath, request, response, params);
                return;
              }
              const mime = MIME_TYPES[extname(filePath)] || 'application/octet-stream';
              response.writeHead(200, { 'Content-Type': mime });
              response.end(await readFile(filePath));
              return;
            }
          }
        }
        return next();
      }
    }

    /*
      Extension admin routing: /admin/extension/{name}/** -> extension's admin/ directory
    */
    const adminMatch = url.match(/^\/admin\/extension\/((?:@[^/]+\/)?[^/]+)(\/.*)?$/);
    if(adminMatch){
      const extName = adminMatch[1];
      const subPath = adminMatch[2] || '/';
      const adminDir = join(NODE_MODULES, extName, 'admin');
      const resolveDir = buildResolveDir(ADMIN_ROOT, url);
      const method = request.method?.toUpperCase() || 'GET';
      const globalDirs = await adminGlobalDirs();
      const fragmentDirs = await adminFragmentDirs();

      const pageCandidates = subPath.endsWith('/')
        ? [join(adminDir, subPath, 'index.page.html')]
        : [
            join(adminDir, subPath.replace(/\.html$/, '') + '.page.html'),
            join(adminDir, subPath, 'index.page.html'),
          ];

      for(const pagePath of pageCandidates){
        try {
          await stat(pagePath);
        } catch { continue; }
        await renderGuardedPage(pagePath, request, response, ADMIN_ROOT, resolveDir, {}, globalDirs, fragmentDirs);
        return;
      }

      const staticPath = join(adminDir, subPath === '/' ? 'index.html' : subPath);
      try {
        const fileStat = await stat(staticPath);
        if(fileStat.isFile()){
          const mime = MIME_TYPES[extname(staticPath)] || 'application/octet-stream';
          response.writeHead(200, { 'Content-Type': mime });
          response.end(await readFile(staticPath));
          return;
        }
      } catch { /* try dynamic */ }

      const segments = subPath.replace(/^\//, '').split('/').filter(Boolean);
      const walked = await walkDynamic(adminDir, segments);
      if(walked){
        const { filePath: walkedPath, params } = walked;
        let walkedStat;
        try { walkedStat = await stat(walkedPath); } catch { /* not found */ }
        if(walkedStat?.isDirectory()){
          const served = await serveDir(walkedPath, method, request, response, resolveDir, ADMIN_ROOT, params, globalDirs, fragmentDirs);
          if(served) return;
        } else if(walkedStat?.isFile()){
          const name = walkedPath.split(/[/\\]/).pop();
          if(name.endsWith('.page.html')){
            await renderGuardedPage(walkedPath, request, response, ADMIN_ROOT, resolveDir, params, globalDirs, fragmentDirs);
            return;
          }
          if(ROUTE_FILES.includes(name)){
            await executeRouteFile(walkedPath, request, response, params);
            return;
          }
          const mime = MIME_TYPES[extname(walkedPath)] || 'application/octet-stream';
          response.writeHead(200, { 'Content-Type': mime });
          response.end(await readFile(walkedPath));
          return;
        }
      }

      return next();
    }

    /*
      Extension public scope routing: /{scope}/** -> extension's public/ directory
    */
    const extensions = await getEnabledExtensions();

    /*
      Resolved once for every public render below — an extension's own scoped pages, the consumer's
      pages, and the 404 alike — so any enabled extension can contribute to any of them.
    */
    const publicContentDirs = await extensionPublicDirs();

    const loaded = [];
    for(const ext of extensions){
      const extRoot = join(NODE_MODULES, ext.name);
      try {
        loaded.push({ extRoot, kempo: (await readKempoConfig(extRoot)).kempo });
      } catch { /* not readable: nothing to route */ }
    }

    /*
      An extension may answer on a short address it declares in `aliases` (`/cart` for `/commerce/cart`);
      the routing below then treats the request as if it had arrived at the real address. A page the
      site has of its own at that address always wins (see server/utils/extensions/aliases.js).
    */
    const routedUrl = await resolveAlias(url, loaded, PROJECT_PUBLIC);

    for(const { extRoot, kempo } of loaded){
      /*
        An extension may claim several scopes, each serving a folder of its package ("public-scope" serves
        public/, "public-scopes" names others). Installing or enabling one that claims an address another
        enabled extension has is refused, so at most one extension matches any request.
      */
      const [, scopes] = normalizeScopes(kempo);
      const claimed = scopes.find(({ scope }) => routedUrl === `/${scope}` || routedUrl.startsWith(`/${scope}/`));
      if(!claimed) continue;

      const scopePrefix = `/${claimed.scope}`;
      const publicDir = join(extRoot, claimed.dir);
      const subPath = routedUrl.slice(scopePrefix.length) || '/';
      const method = request.method?.toUpperCase() || 'GET';
      const resolveDir = buildResolveDir(PROJECT_PUBLIC, url);
      const segments = subPath.replace(/^\//, '').split('/').filter(Boolean);

      if(segments.length === 0){
        const served = await serveDir(publicDir, method, request, response, resolveDir, PROJECT_PUBLIC, {}, publicContentDirs, publicContentDirs);
        if(served) return;
        return next();
      }

      const walked = await walkDynamic(publicDir, segments);
      if(walked){
        const { filePath, params } = walked;
        let fileStat;
        try { fileStat = await stat(filePath); } catch { /* not found */ }

        if(fileStat?.isDirectory()){
          const served = await serveDir(filePath, method, request, response, resolveDir, PROJECT_PUBLIC, params, publicContentDirs, publicContentDirs);
          if(served) return;
        } else if(fileStat?.isFile()){
          const name = filePath.split(/[/\\]/).pop();
          if(name.endsWith('.page.html')){
            await renderGuardedPage(filePath, request, response, PROJECT_PUBLIC, resolveDir, params, publicContentDirs, publicContentDirs);
            return;
          }
          if(ROUTE_FILES.includes(name)){
            await executeRouteFile(filePath, request, response, params);
            return;
          }
          const mime = MIME_TYPES[extname(filePath)] || 'application/octet-stream';
          response.writeHead(200, { 'Content-Type': mime });
          response.end(await readFile(filePath));
          return;
        }
      }

      // File not found in extension's public dir — fall through to consumer page routing
      break;
    }

    /*
      Consumer public page routing: intercept .page.html before kempo-server SSR handles them
    */
    {
      const resolveDir = buildResolveDir(PROJECT_PUBLIC, url);
      const urlPath = url.replace(/\/+$/, '');

      // Mirror kempo-server's SSR probe: url.page.html and url/index.page.html
      const candidates = [
        join(PROJECT_PUBLIC, urlPath + '.page.html'),
        join(PROJECT_PUBLIC, urlPath, 'index.page.html'),
      ];

      for(const pageFilePath of candidates){
        try { await stat(pageFilePath); } catch { continue; }
        await renderGuardedPage(pageFilePath, request, response, PROJECT_PUBLIC, resolveDir, {}, publicContentDirs, publicContentDirs);
        return;
      }
    }

    next();
  };
};
