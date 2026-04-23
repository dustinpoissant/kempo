import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteGroup from '../../../../server/utils/groups/deleteGroup.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { names } = request.body;

	if(!names || !Array.isArray(names) || names.length === 0){
		return response.status(400).json({ error: 'Names array is required' });
	}

	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:group:delete');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const nonAdmin = names.filter(n => {
		const owner = n.includes(':') ? n.split(':')[0] : null;
		return owner && owner !== 'admin';
	});
	if(nonAdmin.length){
		return response.status(403).json({ error: `Cannot delete non-admin groups: ${nonAdmin.join(', ')}` });
	}

	const deleted = [];
	const errors = [];

	for(const name of names){
		const [error, result] = await deleteGroup(name);
		if(error){
			errors.push({ name, error: error.msg });
		} else {
			deleted.push(result);
		}
	}

	if(errors.length > 0){
		return response.status(207).json({ deleted, errors });
	}

	response.json({ deleted });
};
