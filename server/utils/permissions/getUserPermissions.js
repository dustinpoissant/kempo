import getUserGroups from './getUserGroups.js';
import getPermissionsForGroups from './getPermissionsForGroups.js';
import userHasPermission from './userHasPermission.js';

export default async (userId, requestingUserId = null) => {
  if(requestingUserId && requestingUserId !== userId) {
    const canCheckOthers = await userHasPermission(requestingUserId, 'system:permissions:check-others');
    if(!canCheckOthers) {
      throw new Error('Insufficient permissions to check other users permissions');
    }
  }
  
  const userGroups = await getUserGroups(userId);
  return await getPermissionsForGroups(userGroups);
};
