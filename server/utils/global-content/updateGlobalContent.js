import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
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

export default async ({ rootDir, id, name, location, priority, markup }) => {
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
  const idx = entries.findIndex(e => e.id === id);

  if(idx === -1){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  if(entries[idx].locked){
    return [{ code: 403, msg: 'This global content is locked and cannot be edited' }, null];
  }

  const now = new Date().toISOString();
  if(name !== undefined) entries[idx].name = name;
  if(location !== undefined) entries[idx].location = location;
  if(priority !== undefined) entries[idx].priority = parseInt(priority, 10);
  if(markup !== undefined) entries[idx].markup = markup;
  entries[idx].updatedAt = now;

  await writeFile(filePath, serializeEntries(entries) + '\n', 'utf-8');

  return [null, { id, updatedAt: now }];
};
