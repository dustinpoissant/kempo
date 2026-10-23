import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import renderEmailTemplate from '../../../../../server/utils/email/renderEmailTemplate.js';

/*
  An email template drawn with no data, to open in a tab: what the site would send, with the parts that need data left blank. An
  extension that can do better (real or sample data) serves its own preview and gives it to <k-email-templates> as `preview-url`.
*/
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:pages:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, page] = await renderEmailTemplate({ template: request.query.template, data: {} });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.type('html').send(page);
};
