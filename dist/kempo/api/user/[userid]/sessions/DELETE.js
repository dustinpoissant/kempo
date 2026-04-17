import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteSession from '../../../../../../server/utils/sessions/deleteSession.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:user:update');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { sessionToken } = request.body;

  if(!sessionToken){
    return response.status(400).json({ error: 'Session token is required' });
  }

  const [error, result] = await deleteSession(sessionToken);

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
