import getSession from '../auth/getSession.js';
import userHasPermission from './userHasPermission.js';

export default async (sessionToken, permissionName) => {
  if(!sessionToken){
    return [{ code: 400, msg: 'Session token is required' }, null];
  }
  
  if(!permissionName){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }
  
  const [error, sessionData] = await getSession({ token: sessionToken });
  
  if(error){
    return [null, false];
  }
  
  if(!sessionData || !sessionData.user){
    return [null, false];
  }
  
  return await userHasPermission(sessionData.user.id, permissionName);
};
