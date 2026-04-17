import getUserGroups from './getUserGroups.js';
import getPermissionsForGroups from './getPermissionsForGroups.js';

export default async (userId) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  const [groupsError, userGroups] = await getUserGroups(userId);
  
  if(groupsError){
    return [groupsError, null];
  }
  
  return await getPermissionsForGroups(userGroups);
};
