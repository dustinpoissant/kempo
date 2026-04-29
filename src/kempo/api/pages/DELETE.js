import { resolve } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import getPageMetadata from '../../../../server/utils/pages/getPageMetadata.js';
import deletePage from '../../../../server/utils/pages/deletePage.js';

const rootDir = resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:delete');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { files } = request.body || {};

	if(!files?.length){
		return response.status(400).json({ error: 'No files specified' });
	}

	for(const file of files){
		const [metaError, metadata] = await getPageMetadata({ rootDir, file });
		if(!metaError && metadata.locked){
			return response.status(403).json({ error: `Cannot delete locked page: ${file}` });
		}
	}

	const [error, result] = await deletePage({ rootDir, files });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
