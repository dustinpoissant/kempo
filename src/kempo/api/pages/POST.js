import { resolve } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import getSession from '../../../../server/utils/auth/getSession.js';
import createPage from '../../../../server/utils/pages/createPage.js';

const rootDir = resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:create');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { directory, name, template, extraMetadata, locked } = request.body;

	if(!name){
		return response.status(400).json({ error: 'Page name is required' });
	}

	const [, sessionData] = await getSession({ token });
	const author = sessionData?.user?.name || '';

	const [error, data] = await createPage({ rootDir, directory, name, template, author, extraMetadata, locked });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.status(201).json(data);
};
