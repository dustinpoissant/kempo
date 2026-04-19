import { dirname, join, extname } from 'path';
import { readFile, stat, readdir } from 'fs/promises';
import { pathToFileURL } from 'url';
import { renderExternalPage } from 'kempo-server/templating';
import { getEnabledExtensions } from '../server/utils/extensions/scopeCache.js';

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
const ADMIN_ROOT = join(process.cwd(), 'dist', 'admin');

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

const serveDir = async (dirPath, method, request, response, resolveDir, projectPublic, params = {}) => {
  const candidates = [`${method}.js`, 'index.page.html', 'index.js', 'index.html', 'CATCH.js'];
  for(const candidate of candidates){
    const candidatePath = join(dirPath, candidate);
    try { await stat(candidatePath); } catch { continue; }
    if(candidate.endsWith('.page.html')){
      const html = await renderExternalPage(candidatePath, projectPublic, resolveDir);
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
    const url = request.url.split('?')[0];

    /*
      Core admin routing: /admin/** -> dist/admin/
      Renders .page.html files with ADMIN_ROOT so the admin template and fragments are resolved correctly.
      Must run before kempo-server's custom route handler, which would incorrectly use app-public as rootDir.
    */
    if(url === '/admin' || url.startsWith('/admin/')){
      const subPath = url.slice('/admin'.length) || '/';
      const segments = subPath.replace(/^\//, '').split('/').filter(Boolean);
      const method = request.method?.toUpperCase() || 'GET';

      // Don't intercept extension admin pages here — they're handled below
      if(!url.startsWith('/admin/extension/')){
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
        // Not found in dist/admin — fall through to next()
        return next();
      }
    }

    /*
      Admin extension routing: /admin/extension/{name}/** -> extension's admin/ directory
      Protected by kempo-auth; no enabled check needed here.
    */
    const adminMatch = url.match(/^\/admin\/extension\/((?:@[^/]+\/)?[^/]+)(\/.*)?$/);
    if(adminMatch){
      const extName = adminMatch[1];
      const subPath = adminMatch[2] || '/';
      const extRoot = join(NODE_MODULES, extName);
      const adminDir = join(extRoot, 'admin');
      const pageCandidates = subPath.endsWith('/')
        ? [join(adminDir, subPath, 'index.page.html')]
        : [
            join(adminDir, subPath.replace(/\.html$/, '') + '.page.html'),
            join(adminDir, subPath, 'index.page.html'),
          ];

      const resolveDir = buildResolveDir(ADMIN_ROOT, url);
      for(const pagePath of pageCandidates){
        try {
          await stat(pagePath);
          const html = await renderExternalPage(pagePath, ADMIN_ROOT, resolveDir);
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(html);
          return;
        } catch { /* try next candidate */ }
      }

      const filePath = join(adminDir, subPath === '/' ? 'index.html' : subPath);
      try {
        const stats = await stat(filePath);
        if(stats.isFile()){
          const mime = MIME_TYPES[extname(filePath)] || 'application/octet-stream';
          response.writeHead(200, { 'Content-Type': mime });
          response.end(await readFile(filePath));
          return;
        }
      } catch { /* fall through to next() */ }

      return next();
    }

    /*
      Public scope routing: /{scope}/** -> enabled extension's public/ directory
      Supports: .page.html templates, JS route handlers (GET.js etc.), dynamic [param] dirs, static files.
    */
    const extensions = await getEnabledExtensions();

    for(const ext of extensions){
      let pkgPath, pkg;
      try {
        pkgPath = join(NODE_MODULES, ext.name, 'package.json');
        pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      } catch {
        continue;
      }

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