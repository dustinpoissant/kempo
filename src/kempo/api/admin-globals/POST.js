import { resolve } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import createAdminGlobalContent from '../../../../server/utils/admin-global-content/createAdminGlobalContent.js';

const adminDir = resolve(import.meta.dirname, '../../../../dist/admin');

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:create');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name, location, priority, owner, markup } = request.body;
  const [error, data] = await createAdminGlobalContent({ adminDir, name, location, priority, owner, markup });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
