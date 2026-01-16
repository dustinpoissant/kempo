import getSession from '../../../../../../server/utils/auth/getSession.js';
import getUserPermissions from '../../../../../../server/utils/permissions/getUserPermissions.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';

export default async (request, response) => {
  try {
    const sessionToken = request.cookies.session_token;
    const [sessionError, session] = await getSession({ token: sessionToken });
    
    if(sessionError || !session || !session.user){
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { userid } = request.params;
    const targetUserId = userid === 'current' ? session.user.id : userid;

    const [permsError, userPermissions] = await getUserPermissions(targetUserId, session.user.id);
    
    if(permsError){
      return response.status(permsError.code).json({ error: permsError.msg });
    }

    response.json({ permissions: userPermissions });
  } catch(error){
    console.error('Get user permissions error:', error);
    response.status(500).json({ error: error.message });
  }
};
