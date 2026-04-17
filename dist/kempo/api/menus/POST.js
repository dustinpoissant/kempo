import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import createMenu from '../../../../server/utils/menus/fns/createMenu.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:menus:create');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { slug, name, description } = request.body;

	if(!slug){
		return response.status(400).json({ error: 'Menu slug is required' });
	}

	if(!name){
		return response.status(400).json({ error: 'Menu name is required' });
	}

	const [error, result] = await createMenu({ slug, name, description: description || '' });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
