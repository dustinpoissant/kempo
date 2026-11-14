import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteGuest from '../../../../../../server/utils/guests/deleteGuest.js';

export default async (request, response) => {
  const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:guests:manage');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const [error, result] = await deleteGuest({ token: request.params.token });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json({ success: true, token: result.token });
};
