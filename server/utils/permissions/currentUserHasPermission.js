import getSession from '../auth/getSession.js';
import userHasPermission from './userHasPermission.js';

/*
  Distinguishes "not signed in" from "signed in but not allowed", because they are different
  answers: 401 means authenticate and try again, 403 means authenticating again will not help.

  A missing permission name is a caller mistake rather than anything about the request, so it stays
  a 400. Returning [null, false] is reserved for a valid session that simply lacks the permission,
  which callers turn into 403.
*/
export default async (token, permissionName) => {
  if(!permissionName){
    return [{ code: 400, msg: 'Permission name is required' }, null];
  }

  if(!token){
    return [{ code: 401, msg: 'Authentication required' }, null];
  }

  const [error, sessionData] = await getSession({ token });

  if(error || !sessionData?.user){
    return [{ code: 401, msg: 'Authentication required' }, null];
  }

  return await userHasPermission(sessionData.user.id, permissionName);
};
