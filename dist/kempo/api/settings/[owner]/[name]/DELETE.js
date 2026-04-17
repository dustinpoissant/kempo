import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteSetting from '../../../../../../server/utils/settings/deleteSetting.js';

export default async (request, response) => {
  const sessionToken = request.cookies.session_token;
  const [sessionError, session] = await getSession({ token: sessionToken });
  if(sessionError || !session){
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:custom-settings:manage');
  if(permError || !hasPermission){
    return response.status(403).json({ error: 'Forbidden: Cannot delete settings' });
  }

  const { owner, name } = request.params;

  const [error, result] = await deleteSetting(owner, name);

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
