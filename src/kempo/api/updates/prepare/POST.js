import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import prepareUpdate from '../../../../../server/utils/updates/prepareUpdate.js';

/*
  Installs a newer kempo and/or newer versions of installed extensions next to the running site (Docker volume sites) and answers
  with what switching to them would change. The site is not touched. `{ version, extensions }`: version is the kempo version (the
  newest by default, null to leave kempo as it is), extensions a list of names.
*/
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:updates:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, data] = await prepareUpdate({ version: request.body?.version === null ? null : (request.body?.version || 'latest'), extensions: Array.isArray(request.body?.extensions) ? request.body.extensions : [] });
	if(error) return response.status(error.code).json({ error: error.msg, ...(error.details ? { details: error.details } : {}) });

	response.json(data);
};
