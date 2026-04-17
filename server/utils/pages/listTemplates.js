import { readFile } from 'fs/promises';
import { relative, dirname } from 'path';
import scanDir from '../fs/scanDir.js';
import parseFrontmatter from '../fs/parseFrontmatter.js';

const parseLocations = content => {
  const locations = [];
  const regex = /<location\s([^/]*?)\s*\/>/g;
  let match;
  while((match = regex.exec(content)) !== null){
    const attrs = match[1];
    const nameMatch = /name="([^"]*)"/.exec(attrs);
    const labelMatch = /label="([^"]*)"/.exec(attrs);
    locations.push({
      name: nameMatch?.[1] || 'default',
      label: labelMatch?.[1] || null
    });
  }
  return locations;
};

export default async ({ rootDir }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const templates = await scanDir(rootDir, rootDir, async (fullPath, entry, root) => {
    if(entry.isDirectory() || !entry.name.endsWith('.template.html')) return null;
    const content = await readFile(fullPath, 'utf-8');
    const meta = parseFrontmatter(content);
    const name = entry.name.replace('.template.html', '');
    const relDir = relative(root, dirname(fullPath)).replace(/\\/g, '/');
    return {
      name,
      directory: relDir || '.',
      path: relative(root, fullPath).replace(/\\/g, '/'),
      owner: meta.owner || 'custom',
      locked: meta.locked === 'true',
      author: meta.author || '',
      createdAt: meta.created || '',
      updatedAt: meta.updated || '',
      locations: parseLocations(content)
    };
  });

  return [null, { templates, total: templates.length }];
};

