import getSession from '../../../../../../server/utils/auth/getSession.js';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import setSetting from '../../../../../../server/utils/settings/setSetting.js';
import getSettingWithMetadata from '../../../../../../server/utils/settings/getSettingWithMetadata.js';

export default async (request, response) => {
  const sessionToken = request.cookies.session_token;
  const [sessionError, session] = await getSession({ token: sessionToken });
  if(sessionError || !session){
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const { owner, name } = request.params;

  if(owner === 'system'){
    const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:settings:update');
    if(permError || !hasPermission){
      return response.status(403).json({ error: 'Forbidden: Cannot modify system settings' });
    }
  } else if(owner === 'custom'){
    const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:custom-settings:manage');
    if(permError || !hasPermission){
      return response.status(403).json({ error: 'Forbidden: Cannot manage custom settings' });
    }
  } else {
    const [permError, hasPermission] = await currentUserHasPermission(sessionToken, 'system:extension:configure');
    if(permError || !hasPermission){
      return response.status(403).json({ error: 'Forbidden: Cannot modify extension settings' });
    }
  }

  const { value, type, isPublic, description } = request.body;

  if(value === undefined){
    return response.status(400).json({ error: 'Value is required' });
  }

  /*
    System and extension settings: only value can change, metadata is preserved
  */

  if(owner !== 'custom'){
    const [existingError, existing] = await getSettingWithMetadata(owner, name);
    if(existingError){
      return response.status(existingError.code).json({ error: existingError.msg });
    }
    const [error, result] = await setSetting(owner, name, value, existing.type, existing.isPublic, existing.description);
    if(error){
      return response.status(error.code).json({ error: error.msg });
    }
    return response.json(result);
  }

  const [error, result] = await setSetting(owner, name, value, type, isPublic, description);

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(result);
};
