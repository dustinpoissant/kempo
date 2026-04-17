import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteMenu from '../../../../server/utils/menus/fns/deleteMenu.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { ids } = request.body;

	if(!ids || !Array.isArray(ids) || ids.length === 0){
		return response.status(400).json({ error: 'IDs array is required' });
	}

	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:menus:delete');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const deleted = [];
	const errors = [];

	for(const id of ids){
		const [error, result] = await deleteMenu(id);
		if(error){
			errors.push({ id, error: error.msg });
		} else {
			deleted.push(result);
		}
	}

	if(errors.length > 0){
		return response.status(207).json({ deleted, errors });
	}

	response.json({ deleted });
};
