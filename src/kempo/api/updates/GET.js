import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import getUpdateStatus from '../../../../server/utils/updates/getUpdateStatus.js';

/* Where the site stands: what is running, the newest version on npm and whether it can be installed. `?offline=true` never asks npm, which is what the screen polls with while the server restarts. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:updates:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, data] = await getUpdateStatus({ offline: request.query.offline === 'true' });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json(data);
};
