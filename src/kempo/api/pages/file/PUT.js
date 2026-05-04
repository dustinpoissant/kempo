import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getPageMetadata from '../../../../../server/utils/pages/getPageMetadata.js';
import updatePage from '../../../../../server/utils/pages/updatePage.js';

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

	const { file, name, title, description, author, template, contents, extraMetadata } = request.body;

	if(!file){
		return response.status(400).json({ error: 'File path is required' });
	}

	const [metaError, metadata] = await getPageMetadata({ rootDir, file });
	if(!metaError && metadata.locked){
		return response.status(403).json({ error: 'This page is locked and cannot be edited' });
	}

	const [error, data] = await updatePage({ rootDir, file, name, title, description, author, template, contents, extraMetadata });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
