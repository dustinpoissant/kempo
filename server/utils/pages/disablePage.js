import { readFile, rename } from 'fs/promises';
import { join, normalize, sep } from 'path';
import { existsSync } from 'fs';
import parseFrontmatter from '../fs/parseFrontmatter.js';

export default async ({ rootDir, file }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!file) return [{ code: 400, msg: 'File path is required' }, null];

  const normalized = normalize(file);
  if(normalized.startsWith('..') || normalized.includes('..' + sep)){
    return [{ code: 400, msg: 'Invalid file path' }, null];
  }

  if(!normalized.endsWith('.page.html')){
    return [{ code: 400, msg: 'File must be a .page.html file' }, null];
  }

  const fullPath = join(rootDir, normalized);
  if(!existsSync(fullPath)){
    return [{ code: 404, msg: 'Page not found' }, null];
  }

  const content = await readFile(fullPath, 'utf-8');
  const meta = parseFrontmatter(content);
  if(meta.locked === 'true'){
    return [{ code: 403, msg: 'Cannot disable a locked page' }, null];
  }

  const disabledPath = fullPath.replace(/\.page\.html$/, '.page-disabled.html');
  if(existsSync(disabledPath)){
    return [{ code: 409, msg: 'A disabled version of this page already exists' }, null];
  }

  await rename(fullPath, disabledPath);
  return [null, { file: normalized.replace(/\.page\.html$/, '.page-disabled.html') }];
};
