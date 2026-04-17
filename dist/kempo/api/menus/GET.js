import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import listMenus from '../../../../server/utils/menus/fns/listMenus.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:menus:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const limit = parseInt(request.query.limit) || 50;
	const offset = parseInt(request.query.offset) || 0;
	const owner = request.query.owner || undefined;

	const [error, data] = await listMenus({ limit, offset, owner });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
