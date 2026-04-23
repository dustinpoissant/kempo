import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import disableExtension from '../../../../../server/utils/extensions/disableExtension.js';

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
  const [error, data] = await disableExtension({ name });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
