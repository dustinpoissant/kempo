import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ADMIN_GLOBAL_FILE, parseEntries, serializeEntries } from './helpers.js';

export default async ({ adminDir, ids }) => {
  if(!adminDir){
    return [{ code: 400, msg: 'Admin directory is required' }, null];
  }
  if(!ids?.length){
    return [{ code: 400, msg: 'No IDs specified' }, null];
  }

  const filePath = join(adminDir, ADMIN_GLOBAL_FILE);
  if(!existsSync(filePath)){
    return [{ code: 404, msg: 'Admin global content file not found' }, null];
  }

  const raw = await readFile(filePath, 'utf-8');
  const entries = parseEntries(raw);
  const idSet = new Set(ids);

  for(const entry of entries){
    if(!idSet.has(entry.id)) continue;
    if(entry.locked){
      return [{ code: 403, msg: `Cannot delete locked content: ${entry.name}` }, null];
    }
  }

  const remaining = entries.filter(e => !idSet.has(e.id));
  await writeFile(filePath, remaining.length ? serializeEntries(remaining) + '\n' : '', 'utf-8');

  return [null, { success: true }];
};
