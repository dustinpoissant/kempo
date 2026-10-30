import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import { listStylesheets } from '../../../../server/utils/email/stylesheets.js';

/* Every email stylesheet, without its CSS. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, stylesheets] = await listStylesheets();
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json({ stylesheets });
};
