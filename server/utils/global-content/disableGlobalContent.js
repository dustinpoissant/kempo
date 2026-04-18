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

  const activePath = join(rootDir, GLOBAL_FILE);
  if(!existsSync(activePath)){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  const raw = await readFile(activePath, 'utf-8');
  const entries = parseEntries(raw);
  const idx = entries.findIndex(e => e.id === id);

  if(idx === -1){
    return [{ code: 404, msg: 'Global content not found' }, null];
  }

  if(entries[idx].locked){
    return [{ code: 403, msg: 'Cannot disable locked global content' }, null];
  }

  const entry = entries[idx];
  const remaining = entries.filter((_, i) => i !== idx);
  await writeFile(activePath, serializeEntries(remaining) + (remaining.length ? '\n' : ''), 'utf-8');

  const disabledPath = join(rootDir, GLOBAL_DISABLED_FILE);
  const disabledRaw = existsSync(disabledPath) ? await readFile(disabledPath, 'utf-8') : '';
  const disabledEntries = parseEntries(disabledRaw);
  disabledEntries.push(entry);
  await writeFile(disabledPath, serializeEntries(disabledEntries) + '\n', 'utf-8');

  return [null, { id }];
};
