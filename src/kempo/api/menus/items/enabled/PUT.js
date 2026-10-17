import { existsSync } from 'fs';
import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import setMenuItemEnabled from '../../../../../../server/utils/menus/setMenuItemEnabled.js';

const rootDir = existsSync(join(process.cwd(), 'public')) ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { id, enabled } = request.body || {};

	const [error, data] = await setMenuItemEnabled({ rootDir, id, enabled });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
