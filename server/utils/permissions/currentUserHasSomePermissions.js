import getSession from '../auth/getSession.js';
import userHasSomePermissions from './userHasSomePermissions.js';

export default async (sessionToken, permissionNames) => {
  const sessionData = await getSession({ token: sessionToken });
  if(!sessionData || !sessionData.user) return false;
  
  return await userHasSomePermissions(sessionData.user.id, permissionNames);
};
