import { readFile, writeFile } from 'fs/promises';
import { join, normalize, sep } from 'path';
import { existsSync } from 'fs';

export default async ({ rootDir, file, locked }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!file) return [{ code: 400, msg: 'File path is required' }, null];
  if(typeof locked !== 'boolean') return [{ code: 400, msg: 'locked must be a boolean' }, null];

  const normalized = normalize(file);
  if(normalized.startsWith('..') || normalized.includes('..' + sep)){
    return [{ code: 400, msg: 'Invalid file path' }, null];
  }

  const fullPath = join(rootDir, normalized);
  if(!existsSync(fullPath)){
    return [{ code: 404, msg: 'Template not found' }, null];
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

  if(locked){
    existingMeta.locked = 'true';
  } else {
    delete existingMeta.locked;
  }

  const frontmatter = '<!--\n' +
    Object.entries(existingMeta).map(([k, v]) => `  ${k}: ${v}`).join('\n') +
    '\n-->';

  const body = frontmatterMatch ? raw.slice(frontmatterMatch[0].length) : '\n' + raw;
  await writeFile(fullPath, frontmatter + body, 'utf-8');

  return [null, { file: normalized, locked }];
};
