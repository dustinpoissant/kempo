import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import getSession from '../../../../server/utils/auth/getSession.js';
import createGlobalContent from '../../../../server/utils/global-content/createGlobalContent.js';

const rootDir = import.meta.dirname.includes('node_modules') ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:create');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { name, location, priority } = request.body;

	if(!name){
		return response.status(400).json({ error: 'Name is required' });
	}

	if(!location){
		return response.status(400).json({ error: 'Location is required' });
	}

	const [, sessionData] = await getSession({ token });
	const author = sessionData?.user?.name || '';

	const [error, data] = await createGlobalContent({ rootDir, name, location, priority, author });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.status(201).json(data);
};
