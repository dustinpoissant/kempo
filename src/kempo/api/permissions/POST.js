import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import createPermission from '../../../../server/utils/permissions/createPermission.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { permissions } = request.body;

	if(!permissions || !Array.isArray(permissions) || permissions.length === 0){
		return response.status(400).json({ error: 'Permissions array is required' });
	}

	for(const p of permissions){
		if(!p.resource || p.resource.includes(':')){
			return response.status(400).json({ error: `Invalid resource name: "${p.resource}". Cannot be empty or contain ":"` });
		}
		if(!p.action || p.action.includes(':')){
			return response.status(400).json({ error: `Invalid action: "${p.action}". Cannot be empty or contain ":"` });
		}
	}

	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:permissions:manage');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const created = [];
	const errors = [];

	for(const p of permissions){
		const [error, result] = await createPermission({ resource: p.resource, action: p.action, description: p.description, owner: 'custom' });
		if(error){
			errors.push({ resource: p.resource, action: p.action, error: error.msg });
		} else {
			created.push(result);
		}
	}

	if(errors.length > 0){
		return response.status(207).json({ created, errors });
	}

	response.json({ created });
};
