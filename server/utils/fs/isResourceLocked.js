import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import parseFrontmatter from './parseFrontmatter.js';

export default async ({ rootDir, file, resourceType = 'file' }) => {
  if(!rootDir || !file){
    return [{ code: 400, msg: 'Root directory and file path are required' }, null];
  }

  const safePath = file.replace(/\.\./g, '').replace(/^\//, '');
  const fullPath = join(rootDir, safePath);

  if(!existsSync(fullPath)){
    return [{ code: 404, msg: `${resourceType} not found` }, null];
  }

  const raw = await readFile(fullPath, 'utf-8');
  const meta = parseFrontmatter(raw);

  return [null, meta.locked === 'true'];
};
