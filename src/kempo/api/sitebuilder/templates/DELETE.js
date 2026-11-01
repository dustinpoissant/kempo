import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import deleteTemplate from '../../../../../server/utils/sitebuilder/templates/deleteTemplate.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const [error, data] = await deleteTemplate({ id: request.body?.id });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
