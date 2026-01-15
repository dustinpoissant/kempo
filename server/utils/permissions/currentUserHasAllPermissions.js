import getSession from '../auth/getSession.js';
import userHasAllPermissions from './userHasAllPermissions.js';

export default async (sessionToken, permissionNames) => {
  const sessionData = await getSession({ token: sessionToken });
  if(!sessionData || !sessionData.user) return false;
  
  return await userHasAllPermissions(sessionData.user.id, permissionNames);
};
