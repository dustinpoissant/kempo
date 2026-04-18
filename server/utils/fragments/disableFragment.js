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

  if(!normalized.endsWith('.fragment.html')){
    return [{ code: 400, msg: 'File must be a .fragment.html file' }, null];
  }

  const fullPath = join(rootDir, normalized);
  if(!existsSync(fullPath)){
    return [{ code: 404, msg: 'Fragment not found' }, null];
  }

  const content = await readFile(fullPath, 'utf-8');
  const meta = parseFrontmatter(content);
  if(meta.locked === 'true'){
    return [{ code: 403, msg: 'Cannot disable a locked fragment' }, null];
  }

  const disabledPath = fullPath.replace(/\.fragment\.html$/, '.fragment-disabled.html');
  if(existsSync(disabledPath)){
    return [{ code: 409, msg: 'A disabled version of this fragment already exists' }, null];
  }

  await rename(fullPath, disabledPath);
  return [null, { file: normalized.replace(/\.fragment\.html$/, '.fragment-disabled.html') }];
};
