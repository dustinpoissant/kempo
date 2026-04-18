import { readFile } from 'fs/promises';
import { relative } from 'path';
import scanDir from '../fs/scanDir.js';
import parseFrontmatter from '../fs/parseFrontmatter.js';

export default async ({ rootDir }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const fragments = await scanDir(rootDir, rootDir, async (fullPath, entry, root) => {
    const isDisabled = entry.name.endsWith('.fragment-disabled.html');
    if(entry.isDirectory() || (!entry.name.endsWith('.fragment.html') && !isDisabled)) return null;
    const content = await readFile(fullPath, 'utf-8');
    const meta = parseFrontmatter(content);
    const relPath = relative(root, fullPath).replace(/\\/g, '/');
    return {
      file: relPath,
      name: meta.name || entry.name
        .replace('.fragment-disabled.html', '')
        .replace('.fragment.html', ''),
      owner: meta.owner || 'custom',
      locked: meta.locked === 'true',
      disabled: isDisabled,
      author: meta.author || '',
      createdAt: meta.created || '',
      updatedAt: meta.updated || ''
    };
  });

  return [null, { fragments, total: fragments.length }];
};
