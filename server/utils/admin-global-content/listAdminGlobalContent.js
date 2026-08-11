import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ADMIN_GLOBAL_FILE, parseEntries, ADMIN_GLOBALS_DIR } from './helpers.js';

export default async ({ adminDir = ADMIN_GLOBALS_DIR } = {}) => {
  if(!adminDir){
    return [{ code: 400, msg: 'Admin directory is required' }, null];
  }

  const filePath = join(adminDir, ADMIN_GLOBAL_FILE);
  if(!existsSync(filePath)){
    return [null, { entries: [], total: 0 }];
  }

  const raw = await readFile(filePath, 'utf-8');
  const entries = parseEntries(raw);

  return [null, { entries, total: entries.length }];
};
