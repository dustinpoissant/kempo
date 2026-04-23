import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import addUserToGroup from '../../../../../../server/utils/groups/addUserToGroup.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { userId } = request.body;

	if(!userId){
		return response.status(400).json({ error: 'User ID is required' });
	}

	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:group:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { name } = request.params;
	const [error, result] = await addUserToGroup(userId, decodeURIComponent(name));

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
