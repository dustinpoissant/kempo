import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteUser from '../../../../server/utils/users/deleteUser.js';

export default async (request, response) => {
  try {
    const token = request.cookies.session_token;
    const { ids } = request.body;

    if(!ids || !Array.isArray(ids) || ids.length === 0){
      return response.status(400).json({ error: 'IDs array is required' });
    }

    const [permError, hasPermission] = await currentUserHasPermission(token, 'system:user:delete');

    if(permError){
      return response.status(permError.code).json({ error: permError.msg });
    }

    if(!hasPermission){
      return response.status(403).json({ error: 'Insufficient permissions' });
    }

    const results = [];
    const errors = [];

    for(const id of ids){
      const [error, result] = await deleteUser(id);

      if(error){
        errors.push({ id, error: error.msg });
      } else {
        results.push(result);
      }
    }

    if(errors.length > 0){
      return response.status(207).json({ deleted: results, errors });
    }

    response.json({ deleted: results });
  } catch(error) {
    response.status(500).json({ error: error.message });
  }
};
