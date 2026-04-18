import { readFile } from 'fs/promises';
import { relative } from 'path';
import scanDir from '../fs/scanDir.js';
import parseFrontmatter from '../fs/parseFrontmatter.js';

export default async ({ rootDir }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const pages = await scanDir(rootDir, rootDir, async (fullPath, entry, root) => {
    const isDisabled = entry.name.endsWith('.page-disabled.html');
    if(entry.isDirectory() || (!entry.name.endsWith('.page.html') && !isDisabled)) return null;
    const content = await readFile(fullPath, 'utf-8');
    const meta = parseFrontmatter(content);
    const pageTitle = content.match(/<page\s[^>]*title="([^"]*)">/);
    if(!meta.title && pageTitle) meta.title = pageTitle[1];
    const relPath = relative(root, fullPath).replace(/\\/g, '/');
    const urlPath = '/' + relPath
      .replace(/\.page-disabled\.html$/, '')
      .replace(/\.page\.html$/, '')
      .replace(/(^|\/)index$/, '$1');
    return {
      file: relPath,
      url: urlPath || '/',
      name: meta.name || meta.title || '',
      title: meta.title || '',
      owner: meta.owner || 'custom',
      locked: meta.locked === 'true',
      disabled: isDisabled,
      author: meta.author || '',
      description: meta.description || '',
      createdAt: meta.created || '',
      updatedAt: meta.updated || ''
    };
  });

  return [null, { pages, total: pages.length }];
};

