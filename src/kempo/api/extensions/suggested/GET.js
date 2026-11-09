import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { getSuggestedPeers } from '../../../../../server/utils/extensions/suggestedPeers.js';

/*
  GET /kempo/api/extensions/suggested?names=a,b

  What these installed extensions suggest (`suggestedPeers` in their kempo-config.json) that the site does not run yet, merged,
  each with a reason, who suggests it, and whether it is `missing` or `disabled`. Offered right after an install or an enable, for
  everything that was added. Allowed to whoever can install or manage extensions.
*/
export default async (request, response) => {
  const token = request.cookies.session_token;
  const [installError, canInstall] = await currentUserHasPermission(token, 'system:extensions:install');
  const [permError, allowed] = canInstall ? [installError, true] : await currentUserHasPermission(token, 'system:extensions:manage');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!allowed){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const [error, data] = await getSuggestedPeers({ names: String(request.query.names || '').split(',').map(name => name.trim()) });

  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
