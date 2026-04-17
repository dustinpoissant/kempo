import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import parseFrontmatter from '../fs/parseFrontmatter.js';

const parseContents = content => {
  const blocks = [];
  const regex = /<content(?:\s+location="([^"]*)")?\s*>([\s\S]*?)<\/content>/g;
  let match;
  while((match = regex.exec(content)) !== null){
    blocks.push({
      location: match[1] || 'default',
      content: match[2].trim()
    });
  }
  return blocks;
};

export default async ({ rootDir, file }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!file){
    return [{ code: 400, msg: 'File path is required' }, null];
  }

  const safePath = file.replace(/\.\./g, '').replace(/^\//, '');
  const fullPath = join(rootDir, safePath);

  if(!existsSync(fullPath)){
    return [{ code: 404, msg: 'Page not found' }, null];
  }

  const raw = await readFile(fullPath, 'utf-8');
  const meta = parseFrontmatter(raw);
  const titleMatch = raw.match(/<page\s[^>]*title="([^"]*)"/);
  const templateMatch = raw.match(/<page\s[^>]*template="([^"]*)"/);
  const contents = parseContents(raw);

  return [null, {
    file: safePath,
    name: meta.name || '',
    title: titleMatch ? titleMatch[1] : (meta.title || ''),
    template: templateMatch ? templateMatch[1] : 'default',
    owner: meta.owner || 'custom',
    locked: meta.locked === 'true',
    author: meta.author || '',
    description: meta.description || '',
    createdAt: meta.created || '',
    updatedAt: meta.updated || '',
    contents
  }];
};
