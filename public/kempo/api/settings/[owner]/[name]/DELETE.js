import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteSetting from '../../../../../../server/utils/settings/deleteSetting.js';

export default async (request) => {
  const sessionToken = request.cookies.session_token;
  const [sessionError, session] = await getSession({ token: sessionToken });
  if(sessionError || !session){
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:custom-settings:manage');
  if(permError || !hasPermission){
    return new Response(JSON.stringify({ error: 'Forbidden: Cannot delete settings' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { owner, name } = request.params;
  
  const [error, result] = await deleteSetting(owner, name);
  
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
