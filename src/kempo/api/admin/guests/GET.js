import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import listGuests from '../../../../../server/utils/guests/listGuests.js';

export default async (request, response) => {
  const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:guests:view');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { merged, limit, offset } = request.query;
  const [error, result] = await listGuests({ merged, limit, offset });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
