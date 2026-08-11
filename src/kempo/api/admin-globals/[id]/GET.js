import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getAdminGlobalContent from '../../../../../server/utils/admin-global-content/getAdminGlobalContent.js';


export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const id = request.params.id;
  const [error, data] = await getAdminGlobalContent({ id });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
