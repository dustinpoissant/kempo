import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';

/*
  POST /kempo/api/extensions   { name, withDependencies? }

  Installs an extension. One that is not in node_modules yet is downloaded first, but only if the
  marketplace lists it: this route never runs `npm install` for a name the caller made up. With
  `withDependencies`, the extensions it needs are installed first, in order; the admin shows that list
  for approval before sending it.
*/
export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:install');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  const { name, withDependencies } = request.body || {};

  const { default: getSiteMarketplaceClient } = await import('../../../../server/utils/extensions/getSiteMarketplaceClient.js');
  const { default: getSiteInstallId } = await import('../../../../server/utils/extensions/getSiteInstallId.js');
  const { default: installFromCatalog } = await import('../../../../server/utils/extensions/installFromCatalog.js');

  const [, installId] = await getSiteInstallId();
  const [error, data] = await installFromCatalog({
    name,
    withDependencies: withDependencies === true,
    client: await getSiteMarketplaceClient(),
    installId,
  });

  if(error){
    return response.status(error.code).json({ error: error.msg, needs: error.needs, installed: error.installed });
  }

  response.json(data);
};
