import { dirname, join, extname } from 'path';
import { readFile, stat, readdir } from 'fs/promises';
import { pathToFileURL, fileURLToPath } from 'url';
import { renderExternalPage } from 'kempo-server/templating';
import getSession from '../server/utils/auth/getSession.js';
import currentUserHasPermission from '../server/utils/permissions/currentUserHasPermission.js';
import { getEnabledExtensions } from '../server/utils/extensions/scopeCache.js';
import triggerHook from '../server/utils/hooks/triggerHook.js';

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

// Points to src/admin so live edits are reflected without rebuilding
const ADMIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'admin');

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

const serveDir = async (dirPath, method, request, response, resolveDir, rootDir, params = {}) => {
  const candidates = [`${method}.js`, 'index.page.html', 'index.js', 'index.html', 'CATCH.js'];
  for(const candidate of candidates){
    const candidatePath = join(dirPath, candidate);
    try { await stat(candidatePath); } catch { continue; }
    if(candidate.endsWith('.page.html')){
      const html = await renderExternalPage(candidatePath, rootDir, resolveDir);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
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
  const PROJECT_PUBLIC = config.rootPath || join(process.cwd(), 'public');

  return async (request, response, next) => {
    const { path } = request;
    const url = request.url.split('?')[0];

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
      Admin routing: /admin/** -> ADMIN_ROOT (src/admin for dev)
    */
    if(url === '/admin' || url.startsWith('/admin/')){
      const method = request.method?.toUpperCase() || 'GET';

      if(!url.startsWith('/admin/extension/')){
        const segments = url.slice('/admin'.length).replace(/^\//, '').split('/').filter(Boolean);
        const resolveDir = buildResolveDir(ADMIN_ROOT, url);

        if(segments.length === 0){
          const served = await serveDir(ADMIN_ROOT, method, request, response, resolveDir, ADMIN_ROOT);
          if(served) return;
        } else {
          const walked = await walkDynamic(ADMIN_ROOT, segments);
          if(walked){
            const { filePath, params } = walked;
            let fileStat;
            try { fileStat = await stat(filePath); } catch { /* not found */ }

            if(fileStat?.isDirectory()){
              const served = await serveDir(filePath, method, request, response, resolveDir, ADMIN_ROOT, params);
              if(served) return;
            } else if(fileStat?.isFile()){
              const name = filePath.split(/[/\\]/).pop();
              if(name.endsWith('.page.html')){
                const html = await renderExternalPage(filePath, ADMIN_ROOT, resolveDir);
                response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                response.end(html);
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

      const pageCandidates = subPath.endsWith('/')
        ? [join(adminDir, subPath, 'index.page.html')]
        : [
            join(adminDir, subPath.replace(/\.html$/, '') + '.page.html'),
            join(adminDir, subPath, 'index.page.html'),
          ];

      for(const pagePath of pageCandidates){
        try {
          await stat(pagePath);
          const html = await renderExternalPage(pagePath, ADMIN_ROOT, resolveDir);
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(html);
          return;
        } catch { /* try next */ }
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
          const served = await serveDir(walkedPath, method, request, response, resolveDir, ADMIN_ROOT, params);
          if(served) return;
        } else if(walkedStat?.isFile()){
          const name = walkedPath.split(/[/\\]/).pop();
          if(name.endsWith('.page.html')){
            const html = await renderExternalPage(walkedPath, ADMIN_ROOT, resolveDir);
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(html);
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

    for(const ext of extensions){
      let pkgPath, pkg;
      try {
        pkgPath = join(NODE_MODULES, ext.name, 'package.json');
        pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      } catch { continue; }

      const scope = pkg.kempo?.['public-scope'];
      if(!scope) continue;

      const scopePrefix = `/${scope}`;
      if(url !== scopePrefix && !url.startsWith(`${scopePrefix}/`)) continue;

      const publicDir = join(dirname(pkgPath), 'public');
      const subPath = url.slice(scopePrefix.length) || '/';
      const method = request.method?.toUpperCase() || 'GET';
      const resolveDir = buildResolveDir(PROJECT_PUBLIC, url);
      const segments = subPath.replace(/^\//, '').split('/').filter(Boolean);

      if(segments.length === 0){
        const served = await serveDir(publicDir, method, request, response, resolveDir, PROJECT_PUBLIC);
        if(served) return;
        return next();
      }

      const walked = await walkDynamic(publicDir, segments);
      if(walked){
        const { filePath, params } = walked;
        let fileStat;
        try { fileStat = await stat(filePath); } catch { /* not found */ }

        if(fileStat?.isDirectory()){
          const served = await serveDir(filePath, method, request, response, resolveDir, PROJECT_PUBLIC, params);
          if(served) return;
        } else if(fileStat?.isFile()){
          const name = filePath.split(/[/\\]/).pop();
          if(name.endsWith('.page.html')){
            try {
              await triggerHook('middleware:before_page', { url, query: request.query || {}, params, cookies: request.cookies || {} }, { bail: true });
            } catch(e) {
              if(e?.redirect) return response.redirect(e.redirect);
              const code = e?.code || 404;
              response.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
              response.end('');
              return;
            }
            const html = await renderExternalPage(filePath, PROJECT_PUBLIC, resolveDir);
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(html);
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

      return next();
    }

    next();
  };
};
