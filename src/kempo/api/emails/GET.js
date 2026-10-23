import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import listEmails from '../../../../server/utils/email/listEmails.js';

/* The log of emails, newest first, without their bodies. `?status=`, `?type=`, `?search=`, `?limit=`, `?offset=`. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const { status, type, search, limit, offset } = request.query;
	const [error, data] = await listEmails({ status, type, search, limit, offset });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json(data);
};
