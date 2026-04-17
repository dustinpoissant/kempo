import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import updateMenuItem from '../../../../../../server/utils/menus/fns/updateMenuItem.js';

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
	const { id, label, type, pageId, url, target, parentId, order } = request.body;

	if(!id){
		return response.status(400).json({ error: 'Item ID is required' });
	}

	const updates = {};
	if(label !== undefined) updates.label = label;
	if(type !== undefined) updates.type = type;
	if(pageId !== undefined) updates.pageId = pageId;
	if(url !== undefined) updates.url = url;
	if(target !== undefined) updates.target = target;
	if(parentId !== undefined) updates.parentId = parentId;
	if(order !== undefined) updates.order = order;

	const [error, result] = await updateMenuItem(menuId, id, updates);

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
