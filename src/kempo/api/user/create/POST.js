import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import createUser from '../../../../../server/utils/users/createUser.js';

export default async (request, response) => {
	try {
		const token = request.cookies.session_token;
		const { name, email, password, emailVerified } = request.body;

		const [permError, hasPermission] = await currentUserHasPermission(token, 'system:user:create');

		if(permError){
			return response.status(permError.code).json({ error: permError.msg });
		}

		if(!hasPermission){
			return response.status(403).json({ error: 'Insufficient permissions' });
		}

		const [error, result] = await createUser({ name, email, password, emailVerified });

		if(error){
			return response.status(error.code).json({ error: error.msg });
		}

		response.json(result);
	} catch(error) {
		response.status(500).json({ error: error.message });
	}
};
