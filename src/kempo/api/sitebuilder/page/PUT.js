import { existsSync } from 'fs';
import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSession from '../../../../../server/utils/auth/getSession.js';
import getPageMetadata from '../../../../../server/utils/pages/getPageMetadata.js';
import savePage from '../../../../../server/utils/sitebuilder/savePage.js';

const rootDir = existsSync(join(process.cwd(), 'public')) ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { trees, codeBlocks, changes, loadedHash } = request.body || {};
	const file = String(request.body?.file || '').replace(/\\/g, '/');

	if(!file){
		return response.status(400).json({ error: 'File path is required' });
	}

	const [metaError, metadata] = await getPageMetadata({ rootDir, file });
	if(!metaError && metadata.locked){
		return response.status(403).json({ error: 'This page is locked and cannot be edited' });
	}

	const [, sessionData] = await getSession({ token });
	const [error, data] = await savePage({ rootDir, file, trees, codeBlocks, changes, loadedHash, userId: sessionData?.user?.id || null });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
