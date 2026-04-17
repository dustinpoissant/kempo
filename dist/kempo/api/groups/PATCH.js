import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import updateGroup from '../../../../server/utils/groups/updateGroup.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { name, description, owner } = request.body;

	if(!name){
		return response.status(400).json({ error: 'Group name is required' });
	}

	if (name.startsWith('system:')) {
		return response.status(403).json({ error: 'Permission denied: Cannot edit system-owned groups' });
	}

	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:group:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const updates = {};
	if(description !== undefined) updates.description = description;
	if(owner !== undefined) updates.owner = owner;

	const [error, result] = await updateGroup(name, updates);

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
