import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ADMIN_GLOBAL_FILE, parseEntries, serializeEntries } from './helpers.js';

export default async ({ adminDir, id }) => {
  if(!adminDir){
    return [{ code: 400, msg: 'Admin directory is required' }, null];
  }
  if(!id){
    return [{ code: 400, msg: 'Content ID is required' }, null];
  }

  const filePath = join(adminDir, ADMIN_GLOBAL_FILE);
  if(!existsSync(filePath)){
    return [{ code: 404, msg: 'Admin global content not found' }, null];
  }

  const raw = await readFile(filePath, 'utf-8');
  const entries = parseEntries(raw);
  const idx = entries.findIndex(e => e.id === id);

  if(idx === -1){
    return [{ code: 404, msg: 'Admin global content not found' }, null];
  }

  entries[idx].enabled = false;
  entries[idx].updatedAt = new Date().toISOString();

  await writeFile(filePath, serializeEntries(entries) + '\n', 'utf-8');

  return [null, { id, enabled: false }];
};
