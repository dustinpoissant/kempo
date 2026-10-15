import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import { existsSync } from 'fs';
import { join } from 'path';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:install');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name } = request.body || {};

  /*
    A package that is not in node_modules yet is downloaded first, but only if it is in the catalogue
    and installable: this route never runs `npm install` for a name the caller made up.
  */
  if(typeof name === 'string' && !existsSync(join(process.cwd(), 'node_modules', name, 'package.json'))){
    const { default: getSiteCatalog } = await import('../../../../server/utils/extensions/getSiteCatalog.js');
    const { default: installPackage } = await import('../../../../server/utils/extensions/installPackage.js');
    const { getUnmetDependencies } = await import('../../../../server/utils/extensions/dependencies.js');

    const [, catalog] = await getSiteCatalog();
    const entry = catalog.extensions.find(item => item.name === name);

    if(!entry){
      return response.status(404).json({ error: `Extension package "${name}" is not installed and is not in the extension catalogue` });
    }
    if(!entry.installable){
      return response.status(409).json({ error: `"${name}" is listed but not published yet, so it cannot be installed` });
    }

    const unmet = await getUnmetDependencies(entry.requires.extensions);
    if(unmet.length){
      return response.status(409).json({ error: `Requires ${unmet.join(', ')} to be installed and enabled first` });
    }

    const [downloadError] = await installPackage({ name, version: entry.version });
    if(downloadError){
      return response.status(downloadError.code).json({ error: downloadError.msg });
    }
  }

  const { default: installExtension } = await import('../../../../server/utils/extensions/installExtension.js');
  const [error, data] = await installExtension({ name });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
