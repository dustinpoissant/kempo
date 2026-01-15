import userHasAllPermissions from './userHasAllPermissions.js';

export default async (userId, permissionName) => {
  return await userHasAllPermissions(userId, [permissionName]);
};
