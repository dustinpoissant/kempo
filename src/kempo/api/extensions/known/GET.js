import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getMarketplaceClient from '../../../../../server/utils/extensions/getMarketplaceClient.js';
import getSiteInstallId from '../../../../../server/utils/extensions/getSiteInstallId.js';
import getExtension from '../../../../../server/utils/extensions/getExtension.js';

/*
  The extension marketplace, through this site's server (the browser never calls it directly).

    GET /kempo/api/extensions/known?search=&sort=&limit=&offset=   a page of cards
    GET /kempo/api/extensions/known?name=<name>                    one extension in full, plus whether
                                                                   it is installed here and this site's
                                                                   own rating of it
*/
export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const client = await getMarketplaceClient();
  const { name, search, sort, limit, offset } = request.query;

  if(name){
    const [error, item] = await client.details(name);
    if(error){
      return response.status(error.code).json({ error: error.msg });
    }

    const [, local] = await getExtension({ name });
    let mine = null;
    if(local){
      const [, installId] = await getSiteInstallId();
      const [, given] = installId ? await client.siteRating({ installId, extension: name }) : [null, null];
      mine = given?.rating ?? null;
    }

    return response.json({
      item,
      local: local ? { installed: true, version: local.version, enabled: local.enabled } : { installed: false },
      myRating: mine,
    });
  }

  const [error, page] = await client.list({ search, sort, limit, offset });
  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(page);
};
