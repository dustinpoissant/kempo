import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import listEmailTemplates, { listEveryEmailTemplate } from '../../../../server/utils/email/listEmailTemplates.js';
import { stylesheetChoices, DEFAULT_STYLESHEET } from '../../../../server/utils/email/stylesheets.js';

/* The email templates of the extension named in `?owner=`, every one with `?owner=all`, or kempo's own and the site's when there is none. Each says which stylesheet it uses. */
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:pages:read');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, templates] = request.query.owner === 'all' ? await listEveryEmailTemplate() : await listEmailTemplates({ owner: request.query.owner || null });
	if(error) return response.status(error.code).json({ error: error.msg });

	const choices = await stylesheetChoices();
	response.json({ templates: templates.map(template => ({ ...template, stylesheet: choices[template.template] ?? DEFAULT_STYLESHEET })) });
};
