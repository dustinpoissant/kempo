import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import updateExtension from '../../../../../server/utils/extensions/updateExtension.js';

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
  const version = request.body?.version || 'latest';
  const [error, data] = await updateExtension({ name, version });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
