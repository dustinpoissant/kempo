import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getUserById from '../../../../../server/utils/users/getUserById.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:user:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { userid } = request.params;
  const [error, user] = await getUserById(userid);

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(user);
};
