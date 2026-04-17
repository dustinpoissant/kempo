import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import getPermissionsForGroups from '../../../../../../server/utils/permissions/getPermissionsForGroups.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:permissions:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { name } = request.params;
	const groupName = decodeURIComponent(name);
	const [error, permissions] = await getPermissionsForGroups([{ name: groupName }]);

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json({ permissions });
};
