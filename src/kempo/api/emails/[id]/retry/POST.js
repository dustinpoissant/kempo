import currentUserHasPermission from '../../../../../../server/utils/permissions/currentUserHasPermission.js';
import retryEmail from '../../../../../../server/utils/email/retryEmail.js';

/* Tries an email that is waiting or failed again. Answers with how that try went. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:emails:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, result] = await retryEmail(request.params.id);
	if(error) return error.code === 502 || error.code === 503 ? response.json({ sent: false, error: error.msg }) : response.status(error.code).json({ error: error.msg });

	response.json({ sent: true, ...result });
};
