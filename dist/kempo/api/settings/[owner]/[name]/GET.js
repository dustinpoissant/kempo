import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSettingWithMetadata from '../../../../../../server/utils/settings/getSettingWithMetadata.js';

export default async (request, response) => {
  const { owner, name } = request.params;

  const [error, setting] = await getSettingWithMetadata(owner, name);

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  if(!setting.isPublic){
    const sessionToken = request.cookies.session_token;
    const [sessionError, session] = await getSession({ token: sessionToken });
    if(sessionError || !session){
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:settings:read');
    if(permError || !hasPermission){
      return response.status(403).json({ error: 'Forbidden' });
    }
  }

  response.json(setting);
};

