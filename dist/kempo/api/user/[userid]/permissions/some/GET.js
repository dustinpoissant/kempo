import getSession from '../../../../../../../server/utils/auth/getSession.js';
import getUserPermissions from '../../../../../../../server/utils/permissions/getUserPermissions.js';
import userHasPermission from '../../../../../../../server/utils/permissions/userHasPermission.js';

export default async (request, response) => {
  try {
    /*
      Which permissions are they checking?
    */
    const permissionsParam = request.query.permissions;
    if(!permissionsParam){
      return response.status(400).json({ error: 'permissions parameter required' });
    }
    
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
      They are either checking their own permissions, or have permission to check someone elses
    */
    const permissionsToCheck = permissionsParam.split(',').map(p => p.trim());

    const [permsError, userPermissions] = await getUserPermissions(targetUserId);
    
    if(permsError){
      return response.status(permsError.code).json({ error: permsError.msg });
    }
    
    const permissionNames = new Set(userPermissions.map(p => p.name));

    const hasSome = permissionsToCheck.some(p => permissionNames.has(p));

    response.json({ hasPermission: hasSome });
  } catch(error){
    console.error('Check some permissions error:', error);
    response.status(500).json({ error: error.message });
  }
};
