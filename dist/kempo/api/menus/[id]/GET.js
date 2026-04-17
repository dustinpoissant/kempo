import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getMenu from '../../../../../server/utils/menus/fns/getMenu.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:menus:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { id } = request.params;
	const [error, result] = await getMenu(id);

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
