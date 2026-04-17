import { readFile, unlink } from 'fs/promises';
import { join, normalize, sep } from 'path';
import parseFrontmatter from '../fs/parseFrontmatter.js';

export default async ({ rootDir, files }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!files?.length) return [{ code: 400, msg: 'No files specified' }, null];

  for(const file of files){
    const normalized = normalize(file);
    if(normalized.startsWith('..') || normalized.includes('..' + sep)){
      return [{ code: 400, msg: 'Invalid file path' }, null];
    }

    const fullPath = join(rootDir, normalized);
    let content;
    try {
      content = await readFile(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const meta = parseFrontmatter(content);
    if(meta.locked === 'true'){
      return [{ code: 403, msg: `Cannot delete locked template: ${file}` }, null];
    }
    if(meta.owner && meta.owner !== 'custom'){
      return [{ code: 403, msg: `Cannot delete template: ${file}` }, null];
    }

    await unlink(fullPath);
  }

  return [null, { deleted: files.length }];
};
