import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import listEmailTemplates from '../../../../server/utils/email/listEmailTemplates.js';

/* The email templates of the extension named in `?owner=`, or kempo's own and the site's when there is none. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:pages:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, templates] = await listEmailTemplates({ owner: request.query.owner || null });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json({ templates });
};
