import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { GLOBAL_FILE, GLOBAL_DISABLED_FILE, parseEntries } from './helpers.js';

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

export default async ({ rootDir, id }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!id){
    return [{ code: 400, msg: 'Global content ID is required' }, null];
  }

  const disabledPath = join(rootDir, GLOBAL_DISABLED_FILE);
  if(!existsSync(disabledPath)){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  const raw = await readFile(disabledPath, 'utf-8');
  const entries = parseEntries(raw);
  const idx = entries.findIndex(e => e.id === id);

  if(idx === -1){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  const entry = entries[idx];
  const remaining = entries.filter((_, i) => i !== idx);
  await writeFile(disabledPath, serializeEntries(remaining) + (remaining.length ? '\n' : ''), 'utf-8');

  const activePath = join(rootDir, GLOBAL_FILE);
  const activeRaw = existsSync(activePath) ? await readFile(activePath, 'utf-8') : '';
  const activeEntries = parseEntries(activeRaw);
  activeEntries.push(entry);
  await writeFile(activePath, serializeEntries(activeEntries) + '\n', 'utf-8');

  return [null, { id }];
};
