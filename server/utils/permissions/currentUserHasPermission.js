import getSession from '../auth/getSession.js';
import userHasPermission from './userHasPermission.js';

export default async (sessionToken, permissionName) => {
  const sessionData = await getSession({ token: sessionToken });
  if(!sessionData || !sessionData.user) return false;
  
  return await userHasPermission(sessionData.user.id, permissionName);
};
