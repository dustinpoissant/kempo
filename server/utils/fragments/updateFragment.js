import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import triggerHook from '../hooks/triggerHook.js';

export default async ({ rootDir, file, author, markup }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!file){
    return [{ code: 400, msg: 'File path is required' }, null];
  }

  const safePath = file.replace(/\.\./g, '').replace(/^\//, '');
  const fullPath = join(rootDir, safePath);

  if(!existsSync(fullPath)){
    return [{ code: 404, msg: 'Fragment not found' }, null];
  }

  const raw = await readFile(fullPath, 'utf-8');

  const frontmatterMatch = raw.match(/^<!--\s*\n([\s\S]*?)\n\s*-->/);
  const existingMeta = {};
  if(frontmatterMatch){
    for(const line of frontmatterMatch[1].split('\n')){
      const idx = line.indexOf(':');
      if(idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if(key) existingMeta[key] = value;
    }
  }

  const now = new Date().toISOString();
  const newMeta = {
    ...existingMeta,
    updated: now
  };
  delete newMeta.name;
  if(author !== undefined) newMeta.author = author;

  const frontmatter = '<!--\n' +
    Object.entries(newMeta).map(([k, v]) => `  ${k}: ${v}`).join('\n') +
    '\n-->';

  const resolvedMarkup = markup !== undefined
    ? markup
    : (frontmatterMatch ? raw.slice(frontmatterMatch[0].length).trim() : raw.trim());

  const newContent = `${frontmatter}\n${resolvedMarkup}\n`;

  await writeFile(fullPath, newContent, 'utf-8');

  await triggerHook('fragment:updated', { file: safePath, updatedAt: now });

  return [null, { file: safePath, updatedAt: now }];
};
