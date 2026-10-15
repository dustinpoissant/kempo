import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import uninstallExtension from '../../../../server/utils/extensions/uninstallExtensionTree.js';

/*
  DELETE /kempo/api/extensions   { name, purgeData?, cascade? }

  Without `cascade`, an extension that others require is refused (409) with the whole tree of what
  depends on it as `dependents`. With `cascade: true` they are uninstalled first, then this one.
*/
export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:uninstall');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name, purgeData, cascade } = request.body;
  const [error, data] = await uninstallExtension({ name, purgeData: purgeData === true, cascade: cascade === true });

  if(error){
    return response.status(error.code).json({ error: error.msg, dependents: error.dependents, uninstalled: error.uninstalled });
  }

  response.json(data);
};
