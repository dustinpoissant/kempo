import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getGroup from '../../../../../server/utils/groups/getGroup.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:group:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { name } = request.params;
	const [error, group] = await getGroup(decodeURIComponent(name));

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(group);
};
