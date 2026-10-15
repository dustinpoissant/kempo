import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import getEnabledDependentTree from '../../../../../../server/utils/extensions/dependentTree.js';

/*
  GET /kempo/api/extensions/<name>/dependents

  The enabled extensions that would have to be disabled along with this one: those that require it,
  and those that require them, and so on. Each says which of the affected ones it requires directly.
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

  const dependents = await getEnabledDependentTree(request.params.name);
  response.json({ dependents });
};
