import getSession from '../../../../../../../server/utils/auth/getSession.js';
import getUserPermissions from '../../../../../../../server/utils/permissions/getUserPermissions.js';

export default async (request, response) => {
  try {
    const sessionToken = request.cookies.session_token;
    const session = await getSession({ token: sessionToken });
    
    if(!session || !session.user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { userid } = request.params;
    const targetUserId = userid === 'current' ? session.user.id : userid;

    const permissionsParam = request.query.permissions;

    if(!permissionsParam) {
      return response.status(400).json({ error: 'permissions parameter required' });
    }

    const permissionsToCheck = permissionsParam.split(',').map(p => p.trim());

    const userPermissions = await getUserPermissions(targetUserId, session.user.id);
    const permissionNames = new Set(userPermissions.map(p => p.name));

    const hasSome = permissionsToCheck.some(p => permissionNames.has(p));

    response.json({ hasPermission: hasSome });
  } catch(error) {
    console.error('Check some permissions error:', error);
    response.status(500).json({ error: error.message });
  }
};
