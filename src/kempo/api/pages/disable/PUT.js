import { resolve } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getPageMetadata from '../../../../../server/utils/pages/getPageMetadata.js';
import disablePage from '../../../../../server/utils/pages/disablePage.js';

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

	const { file } = request.body || {};

	if(!file){
		return response.status(400).json({ error: 'File path is required' });
	}

	const [metaError, metadata] = await getPageMetadata({ rootDir, file });
	if(!metaError && metadata.locked){
		return response.status(403).json({ error: 'Cannot disable a locked page' });
	}

	const [error, result] = await disablePage({ rootDir, file });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
