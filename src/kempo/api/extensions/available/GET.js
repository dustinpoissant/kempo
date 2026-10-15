import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSiteCatalog from '../../../../../server/utils/extensions/getSiteCatalog.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

/*
  Everything this site could install: the packages already in its node_modules that declare a
  kempo-config.json, plus the catalogue's extensions that are not downloaded yet. A catalogue entry
  that is also in node_modules is one item, with the catalogue's requirements on it.
*/
export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const [, catalog] = await getSiteCatalog();
  const known = new Map(catalog.extensions.map(entry => [entry.name, entry]));

  const projectPkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf-8'));
  const allDeps = {
    ...projectPkg.dependencies,
    ...projectPkg.devDependencies,
  };

  const nodeModulesPath = join(process.cwd(), 'node_modules');
  const available = [];
  const local = new Set();

  for(const [depName] of Object.entries(allDeps)){
    try {
      if(!existsSync(join(nodeModulesPath, depName, 'kempo-config.json'))) continue;
      const depPkg = JSON.parse(await readFile(join(nodeModulesPath, depName, 'package.json'), 'utf-8'));
      const entry = known.get(depName);
      local.add(depName);
      available.push({
        name: depName,
        version: depPkg.version,
        description: depPkg.description || entry?.description || '',
        author: (typeof depPkg.author === 'object' ? depPkg.author?.name : depPkg.author) || entry?.author || '',
        installable: true,
        needsDownload: false,
        requires: entry?.requires.extensions || [],
      });
    } catch {}
  }

  for(const entry of catalog.extensions){
    if(local.has(entry.name)) continue;
    available.push({
      name: entry.name,
      version: entry.version,
      description: entry.description,
      author: entry.author,
      installable: entry.installable,
      needsDownload: true,
      requires: entry.requires.extensions,
    });
  }

  available.sort((a, b) => a.name.localeCompare(b.name));
  response.json({ items: available, total: available.length, catalog: { from: catalog.from, fetchedAt: catalog.fetchedAt, problem: catalog.problem } });
};
