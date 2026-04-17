import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { GLOBAL_FILE, parseEntries } from './helpers.js';

const serializeEntries = entries => entries.map(e => {
  const attrs = [
    `id="${e.id}"`,
    `name="${e.name}"`,
    `owner="${e.owner}"`,
    `author="${e.author}"`,
    `created="${e.createdAt}"`,
    `updated="${e.updatedAt}"`,
    `locked="${e.locked}"`,
    `location="${e.location}"`,
    `priority="${e.priority}"`
  ].join(' ');
  return `<content ${attrs}>\n${e.markup}\n</content>`;
}).join('\n');

export default async ({ rootDir, name, location, priority, author }) => {
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
    owner: 'custom',
    author: author || '',
    locked: false,
    location,
    priority: parseInt(priority || '0', 10),
    createdAt: now,
    updatedAt: now,
    markup: ''
  };

  entries.push(entry);
  await writeFile(filePath, serializeEntries(entries) + '\n', 'utf-8');

  return [null, entry];
};
