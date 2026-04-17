import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { GLOBAL_FILE, parseEntries } from './helpers.js';

export default async ({ rootDir, id }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!id){
    return [{ code: 400, msg: 'Global content ID is required' }, null];
  }

  const filePath = join(rootDir, GLOBAL_FILE);
  if(!existsSync(filePath)){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  const raw = await readFile(filePath, 'utf-8');
  const entries = parseEntries(raw);
  const entry = entries.find(e => e.id === id);

  if(!entry){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  return [null, entry];
};
