import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { loadExtensionWidgets } from '../../../../../server/utils/sitebuilder/registry.js';

/*
  The widgets installed extensions declare, as kempo-ui widget definitions (see normalizeExtensionWidget). kempo-ui's own
  widgets, kempo's server widgets (src/kempo/pagebuilder/serverWidgets.js) and its core ones (coreWidgets.js) are registered in the browser, so only
  these need to be sent.
*/
export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:read');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	response.json({ widgets: await loadExtensionWidgets() });
};
