import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import discardUpdate from '../../../../../server/utils/updates/discardUpdate.js';

/* Throws away a prepared update that will not be switched to. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:updates:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, data] = await discardUpdate();
	if(error) return response.status(error.code).json({ error: error.msg, ...(error.details ? { details: error.details } : {}) });

	response.json(data);
};
