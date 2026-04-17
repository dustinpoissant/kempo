import { resolve } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import updateTemplate from '../../../../../server/utils/templates/updateTemplate.js';

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

	const { file, name, author, markup } = request.body;

	if(!file){
		return response.status(400).json({ error: 'File path is required' });
	}

	const [error, data] = await updateTemplate({ rootDir, file, name, author, markup });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
