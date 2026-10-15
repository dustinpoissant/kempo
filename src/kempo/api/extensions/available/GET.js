import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

/*
  The extension packages already downloaded into this site (in node_modules, declared as dependencies,
  with a kempo-config.json) and so installable without a download. Extensions to browse and download
  come from the marketplace: see /kempo/api/extensions/known.
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

  const projectPkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf-8'));
  const allDeps = {
    ...projectPkg.dependencies,
    ...projectPkg.devDependencies,
  };

  const nodeModulesPath = join(process.cwd(), 'node_modules');
  const available = [];

  for(const [depName] of Object.entries(allDeps)){
    try {
      if(!existsSync(join(nodeModulesPath, depName, 'kempo-config.json'))) continue;
      const depPkg = JSON.parse(await readFile(join(nodeModulesPath, depName, 'package.json'), 'utf-8'));
      available.push({
        name: depName,
        version: depPkg.version,
        description: depPkg.description || '',
        author: (typeof depPkg.author === 'object' ? depPkg.author?.name : depPkg.author) || '',
      });
    } catch {}
  }

  response.json({ items: available, total: available.length });
};
