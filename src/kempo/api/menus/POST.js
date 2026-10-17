import { existsSync } from 'fs';
import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import getSession from '../../../../server/utils/auth/getSession.js';
import saveMenu from '../../../../server/utils/menus/saveMenu.js';

const rootDir = existsSync(join(process.cwd(), 'public')) ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const { id, name } = request.body || {};
	const [permError, hasPermission] = await currentUserHasPermission(token, id ? 'system:globals:update' : 'system:globals:create');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const [, sessionData] = await getSession({ token });
	const author = sessionData?.user?.name || '';

	const [error, data] = await saveMenu({ rootDir, id, name, author });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.status(id ? 200 : 201).json(data);
};
