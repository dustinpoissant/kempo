import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import saveEmailTemplate from '../../../../../server/utils/email/saveEmailTemplate.js';

/* Saves the site's version of an email template. Body: `{ template, source }`. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:pages:update');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, saved] = await saveEmailTemplate({ template: request.body?.template, source: request.body?.source });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json(saved);
};
