import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import removeUserFromGroup from '../../../../../../server/utils/groups/removeUserFromGroup.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:group:update');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { userid } = request.params;
  const { groupName } = request.body;

  if(!groupName){
    return response.status(400).json({ error: 'Group name is required' });
  }

  const [error, result] = await removeUserFromGroup(userid, groupName);

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
