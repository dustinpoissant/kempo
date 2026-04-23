import { resolve } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getGlobalContent from '../../../../../server/utils/global-content/getGlobalContent.js';

const rootDir = resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { id } = request.query;

	if(!id){
		return response.status(400).json({ error: 'Global content ID is required' });
	}

	const [error, data] = await getGlobalContent({ rootDir, id });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
