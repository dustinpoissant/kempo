import currentUserHasPermission from '../../../../../server/utils/permissions/currentUserHasPermission.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const knownExtensionsPath = join(import.meta.dirname, '../../../admin/known-extensions.json');

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:extensions:read');

  if(permError){
    return response.status(permError.code).json({ error: permError.msg });
  }

  if(!hasPermission){
    return response.status(403).json({ error: 'Insufficient permissions' });
  }

  if(!existsSync(knownExtensionsPath)){
    return response.json({ items: [], total: 0 });
  }

  const items = JSON.parse(await readFile(knownExtensionsPath, 'utf-8'));
  response.json({ items, total: items.length });
};
