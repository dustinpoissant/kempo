import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import listPages from '../../../../server/utils/pages/listPages.js';

const rootDir = import.meta.dirname.includes('node_modules') ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { owner, showHidden, offset, limit } = request.query;
	const [error, data] = await listPages({
		rootDir,
		owner: owner || undefined,
		showHidden: showHidden !== 'false',
		offset: offset ? parseInt(offset, 10) : 0,
		limit: limit ? parseInt(limit, 10) : 0
	});

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
