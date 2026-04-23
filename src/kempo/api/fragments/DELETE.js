import { resolve } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteFragment from '../../../../server/utils/fragments/deleteFragment.js';

const rootDir = resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:fragments:delete');

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

	const [error, result] = await deleteFragment({ rootDir, files });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
