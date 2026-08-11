import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteAdminGlobalContent from '../../../../server/utils/admin-global-content/deleteAdminGlobalContent.js';


export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:delete');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { ids } = request.body;
  const [error, data] = await deleteAdminGlobalContent({ ids });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
