import getGuestPermissions from './getGuestPermissions.js';

export default async (permissionName, { restricted = false } = {}) => {
  if(!permissionName){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }

  const [error, permissions] = await getGuestPermissions({ restricted });

  if(error){
    return [error, null];
  }

  return [null, permissions.includes(permissionName)];
};
