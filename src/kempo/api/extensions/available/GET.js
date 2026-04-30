import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const knownExtensionsPath = join(import.meta.dirname, '../../../admin/known-extensions.json');

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  let knownExtensions = [];
  if(existsSync(knownExtensionsPath)){
    knownExtensions = JSON.parse(await readFile(knownExtensionsPath, 'utf-8'));
  }

  const pkgPath = join(process.cwd(), 'package.json');
  const projectPkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  const allDeps = {
    ...projectPkg.dependencies,
    ...projectPkg.devDependencies,
  };

  const nodeModulesPath = join(process.cwd(), 'node_modules');
  const available = [];

  for(const [depName] of Object.entries(allDeps)){
    try {
      const kempoConfigPath = join(nodeModulesPath, depName, 'kempo-config.json');
      if(!existsSync(kempoConfigPath)) continue;
      const depPkgPath = join(nodeModulesPath, depName, 'package.json');
      const depPkg = JSON.parse(await readFile(depPkgPath, 'utf-8'));
      const known = knownExtensions.find(k => k.name === depName);
      available.push({
        name: depName,
        version: depPkg.version,
        description: depPkg.description || known?.description || '',
        author: depPkg.author || known?.author || '',
      });
    } catch {}
  }

  response.json({ items: available, total: available.length });
};
