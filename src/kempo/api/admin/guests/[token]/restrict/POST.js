import currentUserHasPermission from '../../../../../../../server/utils/permissions/currentUserHasPermission.js';
import restrictGuest from '../../../../../../../server/utils/guests/restrictGuest.js';

export default async (request, response) => {
  const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:guests:manage');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const [error, result] = await restrictGuest({ token: request.params.token, restricted: request.body?.restricted !== false });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json({ success: true, token: result.token, restricted: !!result.restrictedAt });
};
