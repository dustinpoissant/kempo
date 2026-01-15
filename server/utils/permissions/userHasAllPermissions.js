import getUserGroups from './getUserGroups.js';
import getPermissionsForGroups from './getPermissionsForGroups.js';

export default async (userId, permissionNames) => {
  try {
    const userGroups = await getUserGroups(userId);
    
    if(userGroups.some(g => g.name === 'system:Administrators')) {
      return true;
    }

    const userPermissions = await getPermissionsForGroups(userGroups);
    const userPermissionSet = new Set(userPermissions);

    return permissionNames.every(name => userPermissionSet.has(name));
  } catch(error) {
    console.error('Permission check error:', error);
    return false;
  }
};
