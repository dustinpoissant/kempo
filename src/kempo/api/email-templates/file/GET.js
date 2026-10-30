import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import readEmailTemplate from '../../../../../server/utils/email/readEmailTemplate.js';
import { stylesheetFor } from '../../../../../server/utils/email/stylesheets.js';

/* One email template: what the site sends now, and the packaged version it can go back to. `?template=owner/name`. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:pages:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, template] = await readEmailTemplate({ template: request.query.template });
	if(error) return response.status(error.code).json({ error: error.msg });

	response.json({ ...template, stylesheet: await stylesheetFor(template.template) });
};
