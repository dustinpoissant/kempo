import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import { setSetting } from '../../../../../../server/utils/settings/settings.js';

export default async (request) => {
  const sessionToken = request.cookies.session_token;
  const session = await getSession({ token: sessionToken });
  if(!session){
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { owner, name } = request.params;
  
  if(owner === 'system'){
    const hasPermission = await currentUserHasPermission(sessionToken, 'system:settings:update');
    if(!hasPermission){
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify system settings' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } else if(owner === 'custom'){
    const hasPermission = await currentUserHasPermission(sessionToken, 'system:custom-settings:manage');
    if(!hasPermission){
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot manage custom settings' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } else {
    return new Response(JSON.stringify({ error: 'Forbidden: Only system and custom settings can be modified via API' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const body = await request.json();
  const { value, type, isPublic, description } = body;
  
  if(value === undefined){
    return new Response(JSON.stringify({ error: 'Value is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const result = await setSetting(owner, name, value, type, isPublic, description);
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
};
