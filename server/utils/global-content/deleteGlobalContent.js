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

export default async ({ rootDir, ids }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!ids?.length){
    return [{ code: 400, msg: 'No IDs specified' }, null];
  }

  const filePath = join(rootDir, GLOBAL_FILE);
  if(!existsSync(filePath)){
    return [{ code: 404, msg: 'Global content file not found' }, null];
  }

  const raw = await readFile(filePath, 'utf-8');
  const entries = parseEntries(raw);
  const idSet = new Set(ids);

  for(const entry of entries){
    if(!idSet.has(entry.id)) continue;
    if(entry.locked){
      return [{ code: 403, msg: `Cannot delete locked global content: ${entry.name}` }, null];
    }
    if(entry.owner && entry.owner !== 'custom'){
      return [{ code: 403, msg: `Cannot delete global content: ${entry.name}` }, null];
    }
  }

  const remaining = entries.filter(e => !idSet.has(e.id));
  await writeFile(filePath, remaining.length ? serializeEntries(remaining) + '\n' : '', 'utf-8');

  return [null, { deleted: ids.length }];
};
