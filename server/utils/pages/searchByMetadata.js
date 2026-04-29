import { readFile } from 'fs/promises';
import { relative } from 'path';
import scanDir from '../fs/scanDir.js';
import parseFrontmatter from '../fs/parseFrontmatter.js';

const RESERVED_KEYS = new Set(['owner', 'name', 'author', 'created', 'updated', 'locked', 'title', 'description']);

export default async ({ rootDir, query = {} }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!Object.keys(query).length){
    return [{ code: 400, msg: 'Search query must have at least one key' }, null];
  }

  const queryKeys = Object.keys(query);
  const reservedConflicts = queryKeys.filter(k => RESERVED_KEYS.has(k));
  if(reservedConflicts.length){
    return [{ code: 400, msg: `Cannot search reserved metadata keys: ${reservedConflicts.join(', ')}` }, null];
  }

  const pages = await scanDir(rootDir, rootDir, async (fullPath, entry, root) => {
    if(entry.isDirectory() || !entry.name.endsWith('.page.html')) return null;
    const content = await readFile(fullPath, 'utf-8');
    const meta = parseFrontmatter(content);

    const matches = queryKeys.every(k => {
      const val = meta[k];
      if(val === undefined) return false;
      const expected = String(query[k]);
      return val === expected;
    });

    if(!matches) return null;

    const relPath = relative(root, fullPath).replace(/\\/g, '/');
    const urlPath = '/' + relPath
      .replace(/\.page\.html$/, '')
      .replace(/(^|\/)index$/, '$1');

    const extraMetadata = Object.fromEntries(
      Object.entries(meta).filter(([k]) => !RESERVED_KEYS.has(k))
    );

    return {
      file: relPath,
      url: urlPath || '/',
      name: meta.name || meta.title || '',
      title: meta.title || '',
      owner: meta.owner || 'custom',
      locked: meta.locked === 'true',
      author: meta.author || '',
      description: meta.description || '',
      createdAt: meta.created || '',
      updatedAt: meta.updated || '',
      extraMetadata
    };
  });

  return [null, { pages, total: pages.length }];
};
