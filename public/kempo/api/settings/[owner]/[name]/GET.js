import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import { getSettingWithMetadata } from '../../../../../../server/utils/settings/settings.js';

export default async (request) => {
  const { owner, name } = request.params;
  
  const setting = await getSettingWithMetadata(owner, name);
  
  if(!setting){
    return new Response(JSON.stringify({ error: 'Setting not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if(!setting.isPublic){
    const sessionToken = request.cookies.session_token;
    const session = await getSession({ token: sessionToken });
    if(!session){
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const hasPermission = await currentUserHasPermission(sessionToken, 'system:settings:read');
    if(!hasPermission){
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return new Response(JSON.stringify(setting), {
    headers: { 'Content-Type': 'application/json' }
  });
};

