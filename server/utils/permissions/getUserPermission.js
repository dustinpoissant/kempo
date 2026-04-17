import getUserGroups from './getUserGroups.js';
import getPermissionsForGroups from './getPermissionsForGroups.js';

export default async (userId, permissionName) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(!permissionName){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }
  
  const [groupsError, userGroups] = await getUserGroups(userId);
  
  if(groupsError){
    return [groupsError, null];
  }
  
  if(userGroups.some(g => g.name === 'system:Administrators')){
    return [null, true];
  }
  
  const [permsError, userPermissions] = await getPermissionsForGroups(userGroups);
  
  if(permsError){
    return [permsError, null];
  }
  
  return [null, userPermissions.includes(permissionName)];
};
