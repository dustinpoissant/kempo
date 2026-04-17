import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import updateMenu from '../../../../server/utils/menus/fns/updateMenu.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:menus:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { id, slug, name, description } = request.body;

	if(!id){
		return response.status(400).json({ error: 'Menu ID is required' });
	}

	const updates = {};
	if(slug !== undefined) updates.slug = slug;
	if(name !== undefined) updates.name = name;
	if(description !== undefined) updates.description = description;

	const [error, result] = await updateMenu(id, updates);

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
