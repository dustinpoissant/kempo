import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import rollbackUpdate from '../../../../../server/utils/updates/rollbackUpdate.js';

/* Goes back to the version before the last update and restarts. `{ confirm: { data: true } }` when that also restores the database. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:updates:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, data] = await rollbackUpdate({ confirm: request.body?.confirm || {} });
	if(error) return response.status(error.code).json({ error: error.msg, ...(error.details ? { details: error.details } : {}) });

	response.json(data);
};
