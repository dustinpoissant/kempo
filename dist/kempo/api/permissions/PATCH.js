import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import updatePermission from '../../../../server/utils/permissions/updatePermission.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { name, description } = request.body;

	if(!name){
		return response.status(400).json({ error: 'Permission name is required' });
	}

	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:permissions:manage');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const updates = {};
	if(description !== undefined) updates.description = description;

	const [error, result] = await updatePermission(name, updates);

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
