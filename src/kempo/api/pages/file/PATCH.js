import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import movePage from '../../../../../server/utils/pages/movePage.js';

const rootDir = import.meta.dirname.includes('node_modules') ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { file, newFile } = request.body;

	if(!file){
		return response.status(400).json({ error: 'File path is required' });
	}

	if(!newFile){
		return response.status(400).json({ error: 'New file path is required' });
	}

	const [error, data] = await movePage({ rootDir, file, newFile });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
