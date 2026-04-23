import getSession from '../../../../../../../server/utils/auth/getSession.js';
import getAllPermissions from '../../../../../../../server/utils/permissions/getAllPermissions.js';
import getUserPermissions from '../../../../../../../server/utils/permissions/getUserPermissions.js';
import getUserGroups from '../../../../../../../server/utils/permissions/getUserGroups.js';

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
    
    const userId = request.params.userid === 'current' ? session.user.id : parseInt(request.params.userid);
    
    if(!userId){
      return response.status(400).json({ error: 'Invalid user ID' });
    }
    
    /*
      Get user's groups to check for admin
    */
    const [groupsError, userGroups] = await getUserGroups(userId);
    
    if(groupsError){
      return response.status(groupsError.code).json({ error: groupsError.msg });
    }

    const isAdmin = userGroups.some(group => group.name === 'system:Administrators');

    /*
      If admin, return all permissions
    */
    if(isAdmin){
      const [permsError, allPermissions] = await getAllPermissions({ limit: 10000, offset: 0 });
      
      if(permsError){
        return response.status(permsError.code).json({ error: permsError.msg });
      }

      return response.json({ permissions: allPermissions.permissions.map(p => p.name) });
    }

    /*
      Otherwise, get user's actual permissions
    */
    const [permsError, userPermissions] = await getUserPermissions(userId);
    
    if(permsError){
      return response.status(permsError.code).json({ error: permsError.msg });
    }

    response.json({ permissions: userPermissions });
  } catch(error){
    console.error('List user permissions error:', error);
    response.status(500).json({ error: error.message });
  }
};
