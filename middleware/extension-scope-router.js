import { dirname, join, extname } from 'path';
import { readFile, stat } from 'fs/promises';
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

const NODE_MODULES = join(process.cwd(), 'node_modules');
const ADMIN_ROOT = join(process.cwd(), 'dist', 'admin');

const buildResolveDir = (base, url) => {
  const parts = url.replace(/\/+$/, '').split('/').filter(Boolean);
  let dir = base;
  for(const part of parts) dir = join(dir, part);
  return dir;
};

export default config => {
  const PROJECT_PUBLIC = config.rootPath || join(process.cwd(), 'public');

  return async (request, response, next) => {
    const url = request.url.split('?')[0];

    /*
      Admin extension routing: /admin/extension/{name}/** → extension's admin/ directory
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

      // Static file fallback
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
      Public scope routing: /{scope}/** → enabled extension's public/ directory
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

      const extRoot = dirname(pkgPath);
      const publicDir = join(extRoot, 'public');
      const subPath = url.slice(scopePrefix.length) || '/';

      const pageCandidates = subPath.endsWith('/')
        ? [join(publicDir, subPath, 'index.page.html')]
        : [
            join(publicDir, subPath.replace(/\.html$/, '') + '.page.html'),
            join(publicDir, subPath, 'index.page.html'),
          ];

      const resolveDir = buildResolveDir(PROJECT_PUBLIC, url);

      for(const pagePath of pageCandidates){
        try {
          await stat(pagePath);
          const html = await renderExternalPage(pagePath, PROJECT_PUBLIC, resolveDir);
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(html);
          return;
        } catch { /* try next candidate */ }
      }

      // Static file fallback
      const filePath = join(publicDir, subPath === '/' ? 'index.html' : subPath);
      try {
        const stats = await stat(filePath);
        if(!stats.isFile()) continue;
        const mime = MIME_TYPES[extname(filePath)] || 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': mime });
        response.end(await readFile(filePath));
        return;
      } catch {
        continue;
      }
    }

    next();
  };
};

