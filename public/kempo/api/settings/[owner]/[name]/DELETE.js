import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import { deleteSetting } from '../../../../../../server/utils/settings/settings.js';

export default async (request) => {
  const sessionToken = request.cookies.session_token;
  const session = await getSession({ token: sessionToken });
  if(!session){
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const hasPermission = await currentUserHasPermission(sessionToken, 'system:custom-settings:manage');
  if(!hasPermission){
    return new Response(JSON.stringify({ error: 'Forbidden: Cannot delete settings' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { owner, name } = request.params;
  
  try {
    const result = await deleteSetting(owner, name);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch(error){
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
