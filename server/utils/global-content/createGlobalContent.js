import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { GLOBAL_FILE, parseEntries, serializeEntries } from './helpers.js';
import triggerHook from '../hooks/triggerHook.js';

export default async ({ rootDir, name, location, priority, author, owner = 'custom', markup = '' }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!name){
    return [{ code: 400, msg: 'Name is required' }, null];
  }
  if(!location){
    return [{ code: 400, msg: 'Location is required' }, null];
  }

  const filePath = join(rootDir, GLOBAL_FILE);
  let entries = [];
  if(existsSync(filePath)){
    const raw = await readFile(filePath, 'utf-8');
    entries = parseEntries(raw);
  }

  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    name,
    owner,
    author: author || '',
    locked: false,
    menu: '',
    menuLocations: null,
    menuCopyOf: '',
    navItem: '',
    extra: {},
    location,
    priority: parseInt(priority || '0', 10),
    createdAt: now,
    updatedAt: now,
    markup
  };

  entries.push(entry);
  await writeFile(filePath, serializeEntries(entries) + '\n', 'utf-8');

  await triggerHook('globalContent:created', { id: entry.id, name, location });

  return [null, entry];
};
