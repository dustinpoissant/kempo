import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import setFragmentLocked from '../../../../../server/utils/fragments/setFragmentLocked.js';

const rootDir = import.meta.dirname.includes('node_modules') ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:fragments:update');

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

	const [error, data] = await setFragmentLocked({ rootDir, file, locked });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
