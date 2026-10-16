import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import enableExtension from '../../../../../../server/utils/extensions/enableExtensionTree.js';

/*
  POST /kempo/api/extensions/<name>/enable   { cascade? }

  Without `cascade`, an extension whose requirements are switched off is refused (409) with the whole
  chain of them as `requirements`. With `cascade: true` they are enabled with it.
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

  const name = request.params.name;
  const [error, data] = await enableExtension({ name, cascade: request.body?.cascade === true });

  if(error){
    return response.status(error.code).json({ error: error.msg, requirements: error.requirements, missing: error.missing });
  }

  response.json(data);
};
