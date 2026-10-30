import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { deleteStylesheet } from '../../../../../server/utils/email/stylesheets.js';

/* Deletes an email stylesheet. The templates that used it go back to the default. The default cannot be deleted. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, result] = await deleteStylesheet(request.params.name);
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json(result);
};
