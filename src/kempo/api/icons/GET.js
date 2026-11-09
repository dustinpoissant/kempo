import { existsSync } from 'fs';
import { join, resolve } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import listIcons from '../../../../server/utils/icons/listIcons.js';

/*
  The icons a site can use, for the icon picker: the site's own, kempo's, kempo-ui's and each enabled extension's.
  `?q=` matches part of a name and `?source=` limits the list to one source (see listIcons).
*/
const rootDir = existsSync(join(process.cwd(), 'public')) ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const [error, result] = await listIcons({ rootDir, query: request.query?.q ?? '', source: request.query?.source ?? '' });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(result);
};
