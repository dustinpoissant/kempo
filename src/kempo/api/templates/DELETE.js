import { resolve, join } from 'path';
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import getTemplateMetadata from '../../../../server/utils/templates/getTemplateMetadata.js';
import deleteTemplate from '../../../../server/utils/templates/deleteTemplate.js';

const rootDir = import.meta.dirname.includes('node_modules') ? join(process.cwd(), 'public') : resolve(import.meta.dirname, '../../../../app-public');

export default async (request, response) => {
	const token = request.cookies.session_token;
	const [permError, hasPermission] = await currentUserHasPermission(token, 'system:pages:delete');

	if(permError){
		return response.status(permError.code).json({ error: permError.msg });
	}

	if(!hasPermission){
		return response.status(403).json({ error: 'Insufficient permissions' });
	}

	const { files } = request.body;

	if(!files?.length){
		return response.status(400).json({ error: 'No files specified' });
	}

	for(const file of files){
		const [metaError, metadata] = await getTemplateMetadata({ rootDir, file });
		if(!metaError && metadata.locked){
			return response.status(403).json({ error: `Cannot delete locked template: ${file}` });
		}
	}

	const [error, data] = await deleteTemplate({ rootDir, files });

	if(error){
		return response.status(error.code).json({ error: error.msg });
	}

	response.json(data);
};
