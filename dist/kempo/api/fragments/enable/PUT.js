import { resolve } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import enableFragment from '../../../../../server/utils/fragments/enableFragment.js';

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

	const { file } = request.body || {};

	if(!file){
		return response.status(400).json({ error: 'File path is required' });
	}

	const [error, result] = await enableFragment({ rootDir, file });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
