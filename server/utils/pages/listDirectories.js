import { relative } from 'path';
import scanDir from '../fs/scanDir.js';

export default async ({ rootDir }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const dirs = await scanDir(rootDir, rootDir, (fullPath, entry, root) => {
    if(!entry.isDirectory()) return null;
    return relative(root, fullPath).replace(/\\/g, '/');
  });
  dirs.sort();
  dirs.unshift('.');

  return [null, { directories: dirs }];
};

