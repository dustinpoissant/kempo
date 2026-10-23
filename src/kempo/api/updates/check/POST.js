import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getUpdateStatus from '../../../../../server/utils/updates/getUpdateStatus.js';

/* Asks npm for the newest version now, whatever was found earlier. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:updates:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, data] = await getUpdateStatus({ force: true });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json(data);
};
