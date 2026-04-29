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

  if(!normalized.endsWith('.template.html')){
    return [{ code: 400, msg: 'File must be a .template.html file' }, null];
  }

  const fullPath = join(rootDir, normalized);
  if(!existsSync(fullPath)){
    return [{ code: 404, msg: 'Template not found' }, null];
  }

  const content = await readFile(fullPath, 'utf-8');
  const meta = parseFrontmatter(content);

  const disabledPath = fullPath.replace(/\.template\.html$/, '.template-disabled.html');
  if(existsSync(disabledPath)){
    return [{ code: 409, msg: 'A disabled version of this template already exists' }, null];
  }

  await rename(fullPath, disabledPath);
  return [null, { file: normalized.replace(/\.template\.html$/, '.template-disabled.html') }];
};
