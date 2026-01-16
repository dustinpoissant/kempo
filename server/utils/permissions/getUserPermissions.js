import getUserGroups from './getUserGroups.js';
import getPermissionsForGroups from './getPermissionsForGroups.js';
import userHasPermission from './userHasPermission.js';

export default async (userId, requestingUserId = null) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(requestingUserId && requestingUserId !== userId){
    const [error, canCheckOthers] = await userHasPermission(requestingUserId, 'system:permissions:check-others');
    
    if(error){
      return [error, null];
    }
    
    if(!canCheckOthers){
      return [{ code: 403, msg: 'Insufficient permissions to check other users permissions' }, null];
    }
  }
  
  const [groupsError, userGroups] = await getUserGroups(userId);
  
  if(groupsError){
    return [groupsError, null];
  }
  
  return await getPermissionsForGroups(userGroups);
};
