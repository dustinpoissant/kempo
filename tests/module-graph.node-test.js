import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  Every server-side module must at least load.

  Relative imports that climb the wrong number of directories resolve to a path that does not
  exist, but nothing notices until the one route that uses them is requested — which is how four
  extension endpoints and page search sat broken, returning 500 with ERR_MODULE_NOT_FOUND. Importing
  the whole surface turns that into a build failure instead of a runtime surprise.

  Browser modules (src/admin, src/kempo/components, src/kempo/sdk.js) are deliberately excluded:
  they import from absolute URLs such as /kempo-ui/... that only resolve in a browser.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ROUTE_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

const walk = async dir => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for(const entry of entries){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()){
      files.push(...await walk(full));
    } else if(entry.name.endsWith('.js') && !entry.name.endsWith('.map')){
      files.push(full);
    }
  }
  return files;
};

const surfaces = ['src/kempo/api', 'middleware', 'server'];

// dist/ is what consumers actually load, so check it too whenever it has been built
if(existsSync(path.join(root, 'dist', 'kempo', 'api'))) surfaces.push('dist/kempo/api');

const files = (await Promise.all(surfaces.map(s => walk(path.join(root, s))))).flat();

const isRouteHandler = file => {
  const name = path.basename(file, '.js');
  return file.replace(/\\/g, '/').includes('/api/') && ROUTE_METHODS.includes(name);
};

const tests = {
  'module surface is discoverable': async ({ pass, fail }) => {
    if(files.length < 50){
      return fail(`only found ${files.length} modules across ${surfaces.join(', ')} — the surface list is probably wrong, so this suite would pass without checking anything`);
    }
    pass();
  }
};

for(const file of files){
  const rel = path.relative(root, file).replace(/\\/g, '/');

  tests[`imports ${rel}`] = async ({ pass, fail }) => {
    let module;
    try {
      module = await import(pathToFileURL(file).href);
    } catch(e) {
      return fail(`${e.code || e.constructor.name}: ${e.message.split('\n')[0]}`);
    }

    /*
      A route file that loads but exports no default function is silently skipped by the
      middleware (executeRouteFile returns false), so the route 404s with no error anywhere.
    */
    if(isRouteHandler(file) && typeof module.default !== 'function'){
      return fail(`route handler has no default export function (got ${typeof module.default})`);
    }

    pass();
  };
}

export default tests;
