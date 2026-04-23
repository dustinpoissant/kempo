import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import searchUsers from '../../../../../server/utils/users/searchUsers.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:user:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'You do not have permission to view users' });
  }

  const q = request.query.q || '';
  const limit = Math.min(parseInt(request.query.limit) || 20, 100);
  const offset = parseInt(request.query.offset) || 0;
  const inGroup = request.query.inGroup || undefined;
  const notInGroup = request.query.notInGroup || undefined;

  const [error, data] = await searchUsers({ q, limit, offset, inGroup, notInGroup });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
