import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { ADMIN_GLOBAL_FILE, parseEntries, serializeEntries } from './helpers.js';

export default async ({ adminDir, name, location, priority, owner, markup }) => {
  if(!adminDir){
    return [{ code: 400, msg: 'Admin directory is required' }, null];
  }
  if(!name){
    return [{ code: 400, msg: 'Name is required' }, null];
  }
  if(!location){
    return [{ code: 400, msg: 'Location is required' }, null];
  }

  const filePath = join(adminDir, ADMIN_GLOBAL_FILE);
  let entries = [];
  if(existsSync(filePath)){
    const raw = await readFile(filePath, 'utf-8');
    entries = parseEntries(raw);
  }

  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    name,
    owner: owner || 'custom',
    locked: false,
    enabled: true,
    location,
    priority: parseInt(priority || '0', 10),
    createdAt: now,
    updatedAt: now,
    markup: markup || '',
  };

  entries.push(entry);
  await writeFile(filePath, serializeEntries(entries) + '\n', 'utf-8');

  return [null, entry];
};
