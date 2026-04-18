import { rename } from 'fs/promises';
import { join, normalize, sep } from 'path';
import { existsSync } from 'fs';

export default async ({ rootDir, file }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!file) return [{ code: 400, msg: 'File path is required' }, null];

  const normalized = normalize(file);
  if(normalized.startsWith('..') || normalized.includes('..' + sep)){
    return [{ code: 400, msg: 'Invalid file path' }, null];
  }

  if(!normalized.endsWith('.fragment-disabled.html')){
    return [{ code: 400, msg: 'File must be a .fragment-disabled.html file' }, null];
  }

  const fullPath = join(rootDir, normalized);
  if(!existsSync(fullPath)){
    return [{ code: 404, msg: 'Disabled fragment not found' }, null];
  }

  const enabledPath = fullPath.replace(/\.fragment-disabled\.html$/, '.fragment.html');
  if(existsSync(enabledPath)){
    return [{ code: 409, msg: 'An enabled version of this fragment already exists' }, null];
  }

  await rename(fullPath, enabledPath);
  return [null, { file: normalized.replace(/\.fragment-disabled\.html$/, '.fragment.html') }];
};
