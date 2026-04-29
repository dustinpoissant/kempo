import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import triggerHook from '../hooks/triggerHook.js';

const RESERVED_KEYS = new Set(['owner', 'name', 'author', 'created', 'updated', 'locked', 'title', 'description']);

export default async ({ rootDir, file, name, title, description, author, template, contents, extraMetadata, force = false }) => {
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

  const frontmatterMatch = raw.match(/^<!--\s*\n([\s\S]*?)\n\s*-->/);

  const existingMeta = {};
  if(frontmatterMatch){
    for(const line of frontmatterMatch[1].split('\n')){
      const idx = line.indexOf(':');
      if(idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if(key) existingMeta[key] = value;
    }
  }

  if(extraMetadata !== undefined){
    const conflictingKeys = Object.keys(extraMetadata).filter(k => RESERVED_KEYS.has(k));
    if(conflictingKeys.length){
      return [{ code: 400, msg: `Cannot use reserved metadata keys: ${conflictingKeys.join(', ')}` }, null];
    }
  }

  const now = new Date().toISOString();
  const newMeta = {
    ...existingMeta,
    updated: now
  };
  if(name !== undefined) newMeta.name = name;
  if(title !== undefined) newMeta.title = title;
  if(description !== undefined) newMeta.description = description;
  if(author !== undefined) newMeta.author = author;
  if(extraMetadata !== undefined){
    for(const [k, v] of Object.entries(extraMetadata)){
      newMeta[k] = v;
    }
  }

  const templateMatch = raw.match(/<page\s[^>]*template="([^"]*)"/)
  const resolvedTemplate = template !== undefined ? template : (templateMatch ? templateMatch[1] : 'default');

  const frontmatter = '<!--\n' +
    Object.entries(newMeta).map(([k, v]) => `  ${k}: ${v}`).join('\n') +
    '\n-->';

  const titleMatch = raw.match(/<page\s[^>]*title="[^"]*"/);
  const newTitle = title !== undefined ? title : (titleMatch ? titleMatch[0].match(/title="([^"]*)"/)[1] : '');

  let contentBlocks = '';
  if(contents && contents.length){
    contentBlocks = contents
      .filter(({ content }) => content.trim())
      .map(({ location, content }) => location === 'default'
        ? `<content>\n${content}\n</content>`
        : `<content location="${location}">\n${content}\n</content>`)
      .join('\n');
  } else {
    const originalBlocks = raw.match(/<content[\s\S]*?<\/content>/g) || [];
    contentBlocks = originalBlocks.join('\n');
  }

  const newPageContent = `${frontmatter}\n<page template="${resolvedTemplate}" title="${newTitle}">\n${contentBlocks}\n</page>\n`;

  await writeFile(fullPath, newPageContent, 'utf-8');

  await triggerHook('page:updated', { file: safePath, updatedAt: now });

  return [null, { file: safePath, updatedAt: now }];
};
