import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import removePermissionFromGroup from '../../../../../../server/utils/permissions/removePermissionFromGroup.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { permissionName } = request.body;

	if(!permissionName){
		return response.status(400).json({ error: 'Permission name is required' });
	}

	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:group:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { name } = request.params;
	const [error, result] = await removePermissionFromGroup(decodeURIComponent(name), permissionName);

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
