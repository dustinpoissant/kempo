import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import addMenuItem from '../../../../../../server/utils/menus/fns/addMenuItem.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:menus:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { id: menuId } = request.params;
	const { label, type, pageId, url, target, parentId, order } = request.body;

	if(!label){
		return response.status(400).json({ error: 'Item label is required' });
	}

	const [error, result] = await addMenuItem(menuId, {
		label,
		type: type || 'url',
		pageId: pageId || null,
		url: url || '',
		target: target || '_self',
		parentId: parentId || null,
		order: order ?? 0,
	});

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
