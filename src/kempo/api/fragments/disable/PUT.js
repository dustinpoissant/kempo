import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getFragmentMetadata from '../../../../../server/utils/fragments/getFragmentMetadata.js';
import disableFragment from '../../../../../server/utils/fragments/disableFragment.js';

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

	const [metaError, metadata] = await getFragmentMetadata({ rootDir, file });
	if(!metaError && metadata.locked){
		return response.status(403).json({ error: 'Cannot disable a locked fragment' });
	}

	const [error, result] = await disableFragment({ rootDir, file });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
