import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import getUserGroups from '../../../../../../server/utils/permissions/getUserGroups.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:group:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { userid } = request.params;
  const [error, allGroups] = await getUserGroups(userid);

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  const limit = parseInt(request.query.limit) || 50;
  const offset = parseInt(request.query.offset) || 0;
  const total = allGroups.length;
  response.json({ groups: allGroups.slice(offset, offset + limit), total, limit, offset });
};
