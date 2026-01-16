import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import setSetting from '../../../../../../server/utils/settings/setSetting.js';

export default async (request) => {
  const sessionToken = request.cookies.session_token;
  const [sessionError, session] = await getSession({ token: sessionToken });
  if(sessionError || !session){
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { owner, name } = request.params;
  
  if(owner === 'system'){
    const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:settings:update');
    if(permError || !hasPermission){
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify system settings' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } else if(owner === 'custom'){
    const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:custom-settings:manage');
    if(permError || !hasPermission){
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
  
  const [error, result] = await setSetting(owner, name, value, type, isPublic, description);
  
  if(error){
    return new Response(JSON.stringify({ error: error.msg }), {
      status: error.code,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
};
