import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { GLOBAL_FILE, parseEntries, serializeEntries } from './helpers.js';

export default async ({ rootDir, id, locked }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!id) return [{ code: 400, msg: 'Global content ID is required' }, null];
  if(typeof locked !== 'boolean') return [{ code: 400, msg: 'locked must be a boolean' }, null];

  const filePath = join(rootDir, GLOBAL_FILE);
  if(!existsSync(filePath)){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  const raw = await readFile(filePath, 'utf-8');
  const entries = parseEntries(raw);
  const idx = entries.findIndex(e => e.id === id);

  if(idx === -1){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  entries[idx].locked = locked;

  await writeFile(filePath, serializeEntries(entries) + '\n', 'utf-8');

  return [null, { id, locked }];
};
