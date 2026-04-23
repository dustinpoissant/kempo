import currentUserHasPermission from '../../../../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteExpiredUserSessions from '../../../../../../../server/utils/sessions/deleteExpiredUserSessions.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:user:update');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { userid } = request.params;
  const [error, result] = await deleteExpiredUserSessions(userid);

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
