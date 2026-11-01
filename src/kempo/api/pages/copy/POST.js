import { existsSync } from 'fs';
import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSession from '../../../../../server/utils/auth/getSession.js';
import copyPage from '../../../../../server/utils/pages/copyPage.js';

const rootDir = existsSync(join(process.cwd(), 'public')) ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:create');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { file, newFile } = request.body || {};

	if(!file || !newFile){
		return response.status(400).json({ error: 'A file and a new file are required' });
	}

	const [, sessionData] = await getSession({ token });
	const [error, data] = await copyPage({ rootDir, file, newFile, author: sessionData?.user?.name || '' });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.status(201).json(data);
};
