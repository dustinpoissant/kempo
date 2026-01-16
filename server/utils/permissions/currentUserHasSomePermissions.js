import getSession from '../auth/getSession.js';
import userHasSomePermissions from './userHasSomePermissions.js';

export default async (sessionToken, permissionNames) => {
  if(!sessionToken){
    return [{ code: 400, msg: 'Session token is required' }, null];
  }
  
  if(!permissionNames || permissionNames.length === 0){
    return [{ code: 400, msg: 'Permission names are required' }, null];
  }
  
  const [error, sessionData] = await getSession({ token: sessionToken });
  
  if(error){
    return [null, false];
  }
  
  if(!sessionData || !sessionData.user){
    return [null, false];
  }
  
  return await userHasSomePermissions(sessionData.user.id, permissionNames);
};
