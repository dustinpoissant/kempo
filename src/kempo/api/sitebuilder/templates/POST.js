import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSession from '../../../../../server/utils/auth/getSession.js';
import createTemplate from '../../../../../server/utils/sitebuilder/templates/createTemplate.js';

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:update');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { name, nodes } = request.body || {};
	const [, sessionData] = await getSession({ token });
	const [error, data] = await createTemplate({ name, nodes, userId: sessionData?.user?.id || null });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.status(201).json(data);
};
