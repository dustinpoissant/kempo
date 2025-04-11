import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname, normalize } from 'path';

export class Server {
  constructor(options = {}) {
    this.routes = [];
  }

  route(pattern, handler, methods) {
    const routeMethods = methods ? methods.map(m => m.toUpperCase()) : ['ANY'];
    this.routes.push({
      pattern,
      handler,
      methods: routeMethods
    });
    return this;
  }

  get(path, handler) {
    return this.route(path, handler, ['GET']);
  }

  post(path, handler) {
    return this.route(path, handler, ['POST']);
  }

  put(path, handler) {
    return this.route(path, handler, ['PUT']);
  }

  delete(path, handler) {
    return this.route(path, handler, ['DELETE']);
  }

  patch(path, handler) {
    return this.route(path, handler, ['PATCH']);
  }

  async handleRequest(req, res) {
    try {
      const [ url, paramStr = '' ] = req.url.split('?');
      const params = paramStr.split('&').filter(p=>p!='').map(p => {
        const [key, value] = p.split('=');
        return { [key]: decodeURIComponent(value) };
      });

      const matchedRoute = this.routes.find(({ methods, pattern }) => {
        if(
          !methods.includes(req.method || 'GET') &&
          !methods.includes('ANY')
        ) return false;
        const reqParts = url.split('/').filter(p=>p!='');
        const patternParts = pattern.split('/').filter(p=>p!='');
        if(reqParts.length == 0 && patternParts.length == 0) return true; // '/' == '/'
        const hasWildcard = patternParts.length > 0 && 
                  patternParts[patternParts.length - 1] === '*';
        if (!hasWildcard && reqParts.length !== patternParts.length) return false;
        if (hasWildcard && reqParts.length < patternParts.length - 1) return false;
        const partsToCompare = hasWildcard ? patternParts.length - 1 : patternParts.length;
        for (let i = 0; i < partsToCompare; i++) {
          if (patternParts[i].startsWith(':')) continue;
          if (patternParts[i] !== reqParts[i]) return false;
        }
        return true;
      });

      if(!matchedRoute) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const { pattern, handler } = matchedRoute;
      if(typeof(handler) === 'string') {
        // Extract the remaining path after the matched pattern
        const patternParts = pattern.split('/').filter(p=>p!='');
        const reqParts = url.split('/').filter(p=>p!='');
        const hasWildcard = patternParts[patternParts.length - 1] === '*';
        const remainingPath = hasWildcard 
          ? reqParts.slice(patternParts.length - 1).join('/')
          : '';

        // Remove wildcard from handler if present
        const baseHandler = handler.endsWith('*') 
          ? handler.slice(0, -1) 
          : handler;

        const filePath = baseHandler.startsWith('/') || /^[A-Z]:/i.test(baseHandler)
          ? normalize(join(baseHandler, remainingPath))
          : join(process.cwd(), normalize(join(baseHandler, remainingPath)));

        if (filePath.endsWith('/') || filePath.endsWith('\\')) {
          await Server.serveFile(join(filePath, 'index.html'), res);
        } else {
          await Server.serveFile(filePath, res);
        }
      } else if(typeof(handler) === 'function'){
        const reqVars = {};
        if(pattern.includes(':')){ // Fix typo in includes
          pattern.split('/').filter(p=>p!='').forEach((part, i) => {
            if(part.startsWith(':')){
              reqVars[part.slice(1)] = url.split('/').filter(p=>p!='')[i];
            }
          });
        }
        await handler(req, res, reqVars, params);
      } else {
        console.error('Invalid Route Handler');
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
      
    } catch (err) {
      console.error('Request error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }

  listen(port = 8080) {
    return new Promise((resolve, reject) => {
      try {
        const server = http.createServer((req, res) => this.handleRequest(req, res));
        
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use`));
          } else {
            reject(err);
          }
        });

        server.listen(port, () => {
          resolve(server);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /*
    Static Members
  */
  static mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8'
  };

  static textExtensions = ['.txt', '.md', '.js', '.css', '.html', '.json', '.map'];

  /*
    Static Methods
  */
  static getMimeType(filePath) {
    const ext = extname(filePath).toLowerCase();
    if (this.mimeTypes[ext]) return this.mimeTypes[ext];
    if (this.textExtensions.includes(ext)) {
      return 'text/plain; charset=utf-8';
    }
    return 'application/octet-stream';
  }

  static async serveFile(filePath, res, headers = {}) {
    try {
      const data = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type': Server.getMimeType(filePath),
        ...headers
      });
      res.end(data);
    } catch (err) {
      const status = err.code === 'ENOENT' ? 404 : 500;
      const message = status === 404 ? 'Not found' : 'Internal server error';
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(message);
    }
  }
}
