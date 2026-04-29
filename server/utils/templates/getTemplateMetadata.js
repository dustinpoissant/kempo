import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import parseFrontmatter from '../fs/parseFrontmatter.js';

export default async ({ rootDir, file }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!file){
    return [{ code: 400, msg: 'File path is required' }, null];
  }

  const safePath = file.replace(/\.\./g, '').replace(/^\//, '');
  const fullPath = join(rootDir, safePath);

  if(!existsSync(fullPath)){
    return [{ code: 404, msg: 'Template not found' }, null];
  }

  const raw = await readFile(fullPath, 'utf-8');
  const meta = parseFrontmatter(raw);

  return [null, {
    name: meta.name,
    owner: meta.owner,
    locked: meta.locked === 'true',
    author: meta.author,
    created: meta.created,
    updated: meta.updated
  }];
};
