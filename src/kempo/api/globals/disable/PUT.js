import { resolve } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import disableGlobalContent from '../../../../../server/utils/global-content/disableGlobalContent.js';

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

	const { id } = request.body || {};

	if(!id){
		return response.status(400).json({ error: 'Global content ID is required' });
	}

	const [error, result] = await disableGlobalContent({ rootDir, id });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
