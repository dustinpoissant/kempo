import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import listSettings from '../../../../../server/utils/settings/listSettings.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:settings:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { owner } = request.params;
  const limit = parseInt(request.query.limit) || 50;
  const offset = parseInt(request.query.offset) || 0;
  const [error, data] = await listSettings({ owner, limit, offset });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
