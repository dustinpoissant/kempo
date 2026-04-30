import { unlink } from 'fs/promises';
import { join, normalize, sep } from 'path';
import triggerHook from '../hooks/triggerHook.js';

export default async ({ rootDir, files }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!files?.length) return [{ code: 400, msg: 'No files specified' }, null];

  for(const file of files){
    const normalized = normalize(file);
    if(normalized.startsWith('..') || normalized.includes('..' + sep)){
      return [{ code: 400, msg: 'Invalid file path' }, null];
    }

    const fullPath = join(rootDir, normalized);
    try {
      await unlink(fullPath);
    } catch {
      continue;
    }

    await triggerHook('page:deleted', { file });
  }

  return [null, { deleted: files.length }];
};
