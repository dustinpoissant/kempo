import { readFile, rename, mkdir, readdir, rmdir } from 'fs/promises';
import { join, normalize, dirname, sep } from 'path';
import { existsSync } from 'fs';
import parseFrontmatter from '../fs/parseFrontmatter.js';

const isTraversal = path => path.startsWith('..') || path.includes('..' + sep);

export default async ({ rootDir, file, newFile }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!file) return [{ code: 400, msg: 'File path is required' }, null];
  if(!newFile) return [{ code: 400, msg: 'New file path is required' }, null];

  const normalizedFile = normalize(file);
  const normalizedNewFile = normalize(newFile);

  if(isTraversal(normalizedFile) || isTraversal(normalizedNewFile)){
    return [{ code: 400, msg: 'Invalid file path' }, null];
  }

  const fullPath = join(rootDir, normalizedFile);
  const fullNewPath = join(rootDir, normalizedNewFile);

  let content;
  try {
    content = await readFile(fullPath, 'utf-8');
  } catch {
    return [{ code: 404, msg: 'Fragment not found' }, null];
  }

  const meta = parseFrontmatter(content);
  if(meta.owner && meta.owner !== 'custom'){
    return [{ code: 403, msg: 'Cannot move system fragments' }, null];
  }

  if(existsSync(fullNewPath)){
    return [{ code: 409, msg: 'A fragment already exists at the new location' }, null];
  }

  await mkdir(dirname(fullNewPath), { recursive: true });
  await rename(fullPath, fullNewPath);

  let dir = dirname(fullPath);
  while(dir.startsWith(rootDir) && dir !== rootDir){
    const entries = await readdir(dir);
    if(entries.length > 0) break;
    await rmdir(dir);
    dir = dirname(dir);
  }

  return [null, { file: newFile }];
};
