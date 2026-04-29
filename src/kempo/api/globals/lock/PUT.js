import { resolve } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import setGlobalContentLocked from '../../../../../server/utils/global-content/setGlobalContentLocked.js';

const rootDir = resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { id, locked } = request.body;

	if(!id){
		return response.status(400).json({ error: 'Global content ID is required' });
	}

	if(typeof locked !== 'boolean'){
		return response.status(400).json({ error: 'locked must be a boolean' });
	}

	const [error, data] = await setGlobalContentLocked({ rootDir, id, locked });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
