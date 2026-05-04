import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import parseFrontmatter from '../../../../../server/utils/fs/parseFrontmatter.js';
import enablePage from '../../../../../server/utils/pages/enablePage.js';

const rootDir = import.meta.dirname.includes('node_modules') ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../../app-public');

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

	const [error, result] = await enablePage({ rootDir, file });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
