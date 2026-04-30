import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:install');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name } = request.body;
  const { default: installExtension } = await import('../../../../server/utils/extensions/installExtension.js');
  const [error, data] = await installExtension({ name });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
