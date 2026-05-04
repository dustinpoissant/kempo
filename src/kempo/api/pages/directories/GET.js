import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import listDirectories from '../../../../../server/utils/pages/listDirectories.js';

const rootDir = import.meta.dirname.includes('node_modules') ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const [error, data] = await listDirectories({ rootDir });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
