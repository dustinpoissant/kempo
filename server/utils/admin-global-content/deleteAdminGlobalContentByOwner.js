import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ADMIN_GLOBAL_FILE, parseEntries, serializeEntries } from './helpers.js';

export default async ({ adminDir, owner }) => {
  if(!adminDir){
    return [{ code: 400, msg: 'Admin directory is required' }, null];
  }
  if(!owner){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }

  const filePath = join(adminDir, ADMIN_GLOBAL_FILE);
  if(!existsSync(filePath)){
    return [null, { success: true }];
  }

  const raw = await readFile(filePath, 'utf-8');
  const entries = parseEntries(raw);
  const remaining = entries.filter(e => e.owner !== owner);

  await writeFile(filePath, remaining.length ? serializeEntries(remaining) + '\n' : '', 'utf-8');

  return [null, { success: true }];
};
