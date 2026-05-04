import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import searchByMetadata from '../../../../server/utils/pages/searchByMetadata.js';

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

	const { query } = request.query;

	if(!query){
		return response.status(400).json({ error: 'query parameter is required' });
	}

	let parsedQuery;
	try {
		parsedQuery = JSON.parse(query);
	} catch {
		return response.status(400).json({ error: 'query must be valid JSON' });
	}

	if(typeof parsedQuery !== 'object' || Array.isArray(parsedQuery) || !parsedQuery){
		return response.status(400).json({ error: 'query must be a JSON object' });
	}

	const [error, data] = await searchByMetadata({ rootDir, query: parsedQuery });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
