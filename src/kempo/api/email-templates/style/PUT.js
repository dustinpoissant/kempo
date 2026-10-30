import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { setStylesheetFor } from '../../../../../server/utils/email/stylesheets.js';

/* Chooses the stylesheet an email template is drawn with: { template, stylesheet }. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const { template, stylesheet } = request.body || {};
	const [error, result] = await setStylesheetFor(template, stylesheet);
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json(result);
};
