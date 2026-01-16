import getUserGroups from './getUserGroups.js';
import getPermissionsForGroups from './getPermissionsForGroups.js';

export default async (userId, permissionNames) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(!permissionNames || permissionNames.length === 0){
    return [{ code: 400, msg: 'Permission names are required' }, null];
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
  
  const userPermissionSet = new Set(userPermissions);
  return [null, permissionNames.every(name => userPermissionSet.has(name))];
};
