import { readFile, rename, mkdir, readdir, rmdir, unlink } from 'fs/promises';
import { join, normalize, dirname, sep } from 'path';
import { existsSync } from 'fs';
import parseFrontmatter from '../fs/parseFrontmatter.js';
import { moveRow, deleteRow } from '../sitebuilder/rows.js';

const isTraversal = path => path.startsWith('..') || path.includes('..' + sep);

/*
  `overwrite` lets the move replace a page that is already at the new location, which is how a copy of a page
  becomes the page. Only a custom, unlocked page can be replaced, and the page being replaced loses its builder row.
*/
export default async ({ rootDir, file, newFile, overwrite = false }) => {
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
    return [{ code: 404, msg: 'Page not found' }, null];
  }

  const meta = parseFrontmatter(content);
  if(meta.owner && meta.owner !== 'custom'){
    return [{ code: 403, msg: 'Cannot move system pages' }, null];
  }

  if(existsSync(fullNewPath)){
    if(!overwrite){
      return [{ code: 409, msg: 'A page already exists at the new location' }, null];
    }
    if(fullNewPath === fullPath){
      return [{ code: 400, msg: 'A page cannot replace itself' }, null];
    }
    const target = parseFrontmatter(await readFile(fullNewPath, 'utf-8'));
    if((target.owner && target.owner !== 'custom') || target.locked === 'true'){
      return [{ code: 403, msg: 'That page is locked or managed by the system, so it cannot be replaced' }, null];
    }
    await unlink(fullNewPath);
    await deleteRow(normalizedNewFile.split(sep).join('/'));
  }

  await mkdir(dirname(fullNewPath), { recursive: true });
  await rename(fullPath, fullNewPath);
  await moveRow(normalizedFile.split(sep).join('/'), normalizedNewFile.split(sep).join('/'));

  let dir = dirname(fullPath);
  while(dir.startsWith(rootDir) && dir !== rootDir){
    const entries = await readdir(dir);
    if(entries.length > 0) break;
    await rmdir(dir);
    dir = dirname(dir);
  }

  return [null, { file: newFile }];
};
