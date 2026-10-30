import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getEmail from '../../../../../server/utils/email/getEmail.js';
import mailClientView from '../../../../../server/utils/email/mailClientView.js';

/* One email with its whole body. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, found] = await getEmail(request.params.id);
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json({ ...found, clientHtml: mailClientView(found.html) });
};
