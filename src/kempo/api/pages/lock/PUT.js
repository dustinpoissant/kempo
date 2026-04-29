import { resolve } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import setPageLocked from '../../../../../server/utils/pages/setPageLocked.js';

const rootDir = resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { file, locked } = request.body;

	if(!file){
		return response.status(400).json({ error: 'File path is required' });
	}

	if(typeof locked !== 'boolean'){
		return response.status(400).json({ error: 'locked must be a boolean' });
	}

	const [error, data] = await setPageLocked({ rootDir, file, locked });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
