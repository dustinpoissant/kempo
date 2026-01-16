import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSettingWithMetadata from '../../../../../../server/utils/settings/getSettingWithMetadata.js';

export default async (request) => {
  const { owner, name } = request.params;
  
  const [error, setting] = await getSettingWithMetadata(owner, name);
  
  if(error){
    return new Response(JSON.stringify({ error: error.msg }), {
      status: error.code,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if(!setting.isPublic){
    const sessionToken = request.cookies.session_token;
    const [sessionError, session] = await getSession({ token: sessionToken });
    if(sessionError || !session){
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:settings:read');
    if(permError || !hasPermission){
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

