import getSession from '../auth/getSession.js';
import userHasPermission from './userHasPermission.js';

export default async (token, permissionName) => {
  if(!token){
    return [{ code: 400, msg: 'Session token is required' }, null];
  }
  
  if(!permissionName){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }
  
  const [error, sessionData] = await getSession({ token });
  
  if(error){
    return [null, false];
  }
  
  if(!sessionData || !sessionData.user){
    return [null, false];
  }
  
  return await userHasPermission(sessionData.user.id, permissionName);
};
