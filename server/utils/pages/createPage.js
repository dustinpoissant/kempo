import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import triggerHook from '../hooks/triggerHook.js';

const RESERVED_KEYS = new Set(['owner', 'name', 'author', 'created', 'updated', 'locked', 'title', 'description']);

const slugify = name => name
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export default async ({ rootDir, directory, name, template, author, locked = false, extraMetadata = {} }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!name){
    return [{ code: 400, msg: 'Page name is required' }, null];
  }

  const slug = slugify(name);
  if(!slug){
    return [{ code: 400, msg: 'Page name must contain valid characters' }, null];
  }

  const dir = directory && directory !== '.' && directory !== '/'
    ? directory.replace(/^\//, '').replace(/\/$/, '')
    : '';
  const filePath = dir
    ? join(rootDir, dir, `${slug}.page.html`)
    : join(rootDir, `${slug}.page.html`);

  if(existsSync(filePath)){
    return [{ code: 409, msg: 'A page with this name already exists in this location' }, null];
  }

  const conflictingKeys = Object.keys(extraMetadata).filter(k => RESERVED_KEYS.has(k));
  if(conflictingKeys.length){
    return [{ code: 400, msg: `Cannot use reserved metadata keys: ${conflictingKeys.join(', ')}` }, null];
  }

  const templateName = template || 'default';

  const now = new Date().toISOString();
  const defaultLines = [
    `  owner: custom`,
    `  name: ${name}`,
    `  author: ${author || ''}`,
    `  created: ${now}`,
    `  updated: ${now}`
  ];
  if(locked) defaultLines.push(`  locked: true`);
  const extraLines = Object.entries(extraMetadata).map(([k, v]) => `  ${k}: ${v}`);
  const frontmatter = ['<!--', ...defaultLines, ...extraLines, '-->'].join('\n');

  const pageContent = `${frontmatter}\n<page template="${templateName}" title="${name}">\n</page>\n`;

  const pageDir = dirname(filePath);
  await mkdir(pageDir, { recursive: true });
  await writeFile(filePath, pageContent, 'utf-8');

  const relPath = (dir ? `${dir}/${slug}` : slug);
  const url = '/' + relPath;
  const result = { file: `${relPath}.page.html`, url, title: name, slug };

  await triggerHook('page:created', { file: result.file, url, name, author, extraMetadata });

  return [null, result];
};
