import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import getUsers from '../../../../server/utils/users/getUsers.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:user:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'You do not have permission to view users' });
  }

  const limit = parseInt(request.query.limit) || 50;
  const offset = parseInt(request.query.offset) || 0;
  const [error, data] = await getUsers({ limit, offset });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
