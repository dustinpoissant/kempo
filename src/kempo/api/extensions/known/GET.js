import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import getSiteCatalog from '../../../../../server/utils/extensions/getSiteCatalog.js';

/*
  The catalogue as this site's server has it. The list leaves out each README; `?name=` returns that one
  entry with its README, which is what the Details dialog shows.
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

  const [, catalog] = await getSiteCatalog();
  const meta = { from: catalog.from, fetchedAt: catalog.fetchedAt, problem: catalog.problem };

  const { name } = request.query;
  if(name){
    const item = catalog.extensions.find(entry => entry.name === name);
    if(!item){
      return response.status(404).json({ error: `"${name}" is not in the extension catalogue` });
    }
    return response.json({ item, catalog: meta });
  }

  const items = catalog.extensions.map(({ readme, ...rest }) => ({ ...rest, hasReadme: !!readme }));
  response.json({ items, total: items.length, catalog: meta });
};
