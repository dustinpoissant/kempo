import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import getRequirementTree from '../../../../../../server/utils/extensions/getRequirementTree.js';

/*
  GET /kempo/api/extensions/<name>/requirements

  What this extension needs that is switched off (`disabled`, dependencies first, each saying what it
  requires) and what it needs that is not installed at all (`missing`).
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

  response.json(await getRequirementTree(request.params.name));
};
