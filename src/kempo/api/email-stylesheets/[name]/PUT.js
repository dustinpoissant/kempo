import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { updateStylesheet } from '../../../../../server/utils/email/stylesheets.js';

/* Changes an email stylesheet's description and/or CSS. Its name is not changed. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, stylesheet] = await updateStylesheet(request.params.name, request.body || {});
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json({ stylesheet });
};
