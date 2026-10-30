import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import renderEmailTemplate from '../../../../../server/utils/email/renderEmailTemplate.js';
import readEmailSample from '../../../../../server/utils/email/readEmailSample.js';
import mailClientView from '../../../../../server/utils/email/mailClientView.js';

/*
  An email template drawn to open in a tab: what the site would send. It is filled in with the template's `<name>.sample.json` when
  it has one (made-up values, kept beside the template), and the parts that need data are left blank when it has none. An extension
  that can do better (its own real data) serves its own preview and gives it to <k-email-templates> as `preview-url`.
*/
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:pages:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, page] = await renderEmailTemplate({ template: request.query.template, data: await readEmailSample({ template: request.query.template }) });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.type('html').send(mailClientView(page));
};
