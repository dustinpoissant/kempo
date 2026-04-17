import getSession from '../../../../../../server/utils/auth/getSession.js';
import getUserPermission from '../../../../../../server/utils/permissions/getUserPermission.js';
import getUserPermissions from '../../../../../../server/utils/permissions/getUserPermissions.js';
import userHasPermission from '../../../../../../server/utils/permissions/userHasPermission.js';

export default async (request, response) => {
  try {
    /*
      Are they logged in?
    */
    const sessionToken = request.cookies.session_token;
    const [sessionError, session] = await getSession({ token: sessionToken });
    if(sessionError || !session || !session.user){
      return response.status(401).json({ error: 'Unauthorized' });
    }
    
    /*
      Whos permission are they checking?
    */
    const { userid } = request.params;
    const targetUserId = userid === 'current' ? session.user.id : userid;
    
    /*
      If they are checking another users permissions, do they have permission to do so?
    */
    if(userid !== 'current'){
      const [cPermError, cHasPerm] = await userHasPermission(session.user.id, 'system:permissions:read');
      if(cPermError || !cHasPerm){
        return response.status(403).json({ error: 'Forbidden' });
      }
    }
    
    /*
      Are they checking a specific permission or getting all?
    */
    const permissionName = request.query.permission;
    
    if(permissionName){
      /*
        Check a single permission
      */
      const [permError, hasPermission] = await getUserPermission(targetUserId, permissionName);
      if(permError){
        return response.status(permError.code).json({ error: permError.msg });
      }
      return response.json({ hasPermission });
    }
    
    /*
      Get all of the users permissions
    */
    const [permsError, userPermissions] = await getUserPermissions(targetUserId);
    if(permsError){
      return response.status(permsError.code).json({ error: permsError.msg });
    }
    
    response.json({ permissions: userPermissions });
  } catch(error){
    console.error('Get user permission error:', error);
    response.status(500).json({ error: error.message });
  }
};
