import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { getStylesheet } from '../../../../../server/utils/email/stylesheets.js';

/* One email stylesheet, with its CSS. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, stylesheet] = await getStylesheet(request.params.name);
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json({ stylesheet });
};
