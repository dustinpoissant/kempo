import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import getDependentTree from '../../../../../../server/utils/extensions/getDependentTree.js';

/*
  GET /kempo/api/extensions/<name>/dependents[?includeDisabled=true]

  What would have to go along with this extension: the extensions that require it, and those that
  require them, and so on, deepest first. Each says which of the affected ones it requires directly and
  whether it is enabled.

  By default only enabled ones are listed (what disabling affects). `includeDisabled=true` lists every
  installed one, which is what uninstalling affects.
*/
export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:manage');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const dependents = await getDependentTree(request.params.name, { includeDisabled: request.query.includeDisabled === 'true' });
  response.json({ dependents });
};
