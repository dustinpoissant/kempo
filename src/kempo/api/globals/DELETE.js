import { resolve } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteGlobalContent from '../../../../server/utils/global-content/deleteGlobalContent.js';

const rootDir = resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:delete');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { ids } = request.body || {};

	if(!ids?.length){
		return response.status(400).json({ error: 'No IDs specified' });
	}

	const [error, result] = await deleteGlobalContent({ rootDir, ids });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
