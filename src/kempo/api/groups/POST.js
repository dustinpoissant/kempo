import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import createGroup from '../../../../server/utils/groups/createGroup.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { name, description } = request.body;

	if(!name || !name.trim()){
		return response.status(400).json({ error: 'Group name is required' });
	}

	if(name.includes(':')){
		return response.status(400).json({ error: 'Group name cannot contain ":"' });
	}

	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:group:create');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const [error, result] = await createGroup({ name: `custom:${name}`, description, owner: 'custom' });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
