import userHasAllPermissions from './userHasAllPermissions.js';

export default async (userId, permissionName) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }
  
  if(!permissionName){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }
  
  return await userHasAllPermissions(userId, [permissionName]);
};
