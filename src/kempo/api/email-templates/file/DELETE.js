import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import resetEmailTemplate from '../../../../../server/utils/email/resetEmailTemplate.js';

/* Goes back to the packaged version of an email template, by removing the site's own. Body: `{ template }`. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:pages:update');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, reset] = await resetEmailTemplate({ template: request.body?.template });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json(reset);
};
