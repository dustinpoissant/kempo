import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import listTemplates from '../../../../../server/utils/sitebuilder/templates/listTemplates.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const [error, data] = await listTemplates();

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
