import { existsSync } from 'fs';
import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSession from '../../../../../server/utils/auth/getSession.js';
import openPage from '../../../../../server/utils/sitebuilder/openPage.js';

const rootDir = existsSync(join(process.cwd(), 'public')) ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const file = String(request.query.file || '').replace(/\\/g, '/');

	if(!file){
		return response.status(400).json({ error: 'File path is required' });
	}

	const [, sessionData] = await getSession({ token });
	const [error, data] = await openPage({ rootDir, file, userId: sessionData?.user?.id || null });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
