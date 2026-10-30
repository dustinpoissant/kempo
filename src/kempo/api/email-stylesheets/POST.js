import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import { createStylesheet } from '../../../../server/utils/email/stylesheets.js';

/* Makes an email stylesheet: { name, description, css }. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, stylesheet] = await createStylesheet(request.body || {});
	if(error) return response.status(error.code).json({ error: error.msg });

	response.status(201).json({ stylesheet });
};
