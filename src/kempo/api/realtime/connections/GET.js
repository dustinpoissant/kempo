import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import listConnections from '../../../../../server/utils/realtime/listConnections.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:realtime:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const [error, data] = listConnections();

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
