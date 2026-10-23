import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import applyUpdate from '../../../../../server/utils/updates/applyUpdate.js';
import applyStagedUpdate from '../../../../../server/utils/updates/applyStagedUpdate.js';

/*
  Updates kempo and restarts the server a second after this answers. A site that runs from a Docker volume switches to the update
  that was prepared (`{ confirm: { forced: true, breaking: true } }` where it needs the owner's word, see applyStagedUpdate); any
  other site installs `{ version, extensions }` (kempo's version, the newest by default, null to leave it; a list of extension names) in place.
*/
export default async (request, response) => {
	const [permError, hasPermission] = await currentUserHasPermission(request.cookies.session_token, 'system:updates:manage');
	if(permError) return response.status(permError.code).json({ error: permError.msg });
	if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

	const [error, data] = process.env.KEMPO_SITE_ROOT
		? await applyStagedUpdate({ confirm: request.body?.confirm || {} })
		: await applyUpdate({ version: request.body?.version === null ? null : (request.body?.version || 'latest'), extensions: Array.isArray(request.body?.extensions) ? request.body.extensions : [] });
	if(error) return response.status(error.code).json({ error: error.msg, ...(error.details ? { details: error.details } : {}) });

	response.json(data);
};
