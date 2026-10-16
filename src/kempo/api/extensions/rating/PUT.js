import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSiteMarketplaceClient from '../../../../../server/utils/extensions/getSiteMarketplaceClient.js';
import getSiteInstallId from '../../../../../server/utils/extensions/getSiteInstallId.js';
import getExtension from '../../../../../server/utils/extensions/getExtension.js';

/*
  PUT /kempo/api/extensions/rating   { name, rating: 1-5 }

  This site's rating of an extension it has installed. One per extension; sending it again changes it.
  The marketplace only accepts it once the install is a minute old, and says so if it is not.
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

  const { name, rating } = request.body || {};

  if(!Number.isInteger(rating) || rating < 1 || rating > 5){
    return response.status(400).json({ error: 'rating must be a whole number from 1 to 5' });
  }

  const [localError] = await getExtension({ name });
  if(localError){
    return response.status(localError.code === 404 ? 409 : localError.code).json({ error: localError.code === 404 ? 'Only an extension installed on this site can be rated' : localError.msg });
  }

  const [idError, installId] = await getSiteInstallId();
  if(idError){
    return response.status(idError.code).json({ error: idError.msg });
  }

  const client = await getSiteMarketplaceClient();

  /*
    A site that installed before the marketplace existed was never counted. Reporting is idempotent, so
    do it now: otherwise the marketplace would refuse the rating as "not installed".
  */
  await client.report({ installId, extension: name });

  const [error, data] = await client.rate({ installId, extension: name, value: rating });
  if(error){
    return response.status(error.code).json({ error: error.msg });
  }

  response.json(data);
};
