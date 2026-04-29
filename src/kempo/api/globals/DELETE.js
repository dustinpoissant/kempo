import { resolve } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import getGlobalContentMetadata from '../../../../server/utils/global-content/getGlobalContentMetadata.js';
import deleteGlobalContent from '../../../../server/utils/global-content/deleteGlobalContent.js';

const rootDir = resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:globals:delete');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { ids } = request.body || {};

	if(!ids?.length){
		return response.status(400).json({ error: 'No IDs specified' });
	}

	for(const id of ids){
		const [metaError, metadata] = await getGlobalContentMetadata({ rootDir, id });
		if(!metaError && metadata.locked){
			return response.status(403).json({ error: `Cannot delete locked global content: ${metadata.name}` });
		}
	}

	const [error, result] = await deleteGlobalContent({ rootDir, ids });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
