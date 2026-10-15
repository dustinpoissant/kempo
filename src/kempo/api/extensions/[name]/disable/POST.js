import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import disableExtension from '../../../../../../server/utils/extensions/disableExtension.js';

/*
  POST /kempo/api/extensions/<name>/disable   { cascade? }

  Without `cascade`, an extension that others require is refused (409) with the whole tree of what
  depends on it as `dependents`. With `cascade: true` it and all of them are disabled together.
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
  const [error, data] = await disableExtension({ name, cascade: request.body?.cascade === true });

  if(error){
    return response.status(error.code).json({ error: error.msg, dependents: error.dependents });
  }

  response.json(data);
};
