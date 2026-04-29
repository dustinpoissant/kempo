import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import triggerHook from '../hooks/triggerHook.js';

const slugify = name => name
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export default async ({ rootDir, directory, name, author, locked = false }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }
  if(!name){
    return [{ code: 400, msg: 'Fragment name is required' }, null];
  }

  const slug = slugify(name);
  if(!slug){
    return [{ code: 400, msg: 'Fragment name must contain valid characters' }, null];
  }

  const dir = directory && directory !== '.' && directory !== '/'
    ? directory.replace(/^\//, '').replace(/\/$/, '')
    : '';
  const filePath = dir
    ? join(rootDir, dir, `${slug}.fragment.html`)
    : join(rootDir, `${slug}.fragment.html`);

  if(existsSync(filePath)){
    return [{ code: 409, msg: 'A fragment with this name already exists in this location' }, null];
  }

  const now = new Date().toISOString();
  const frontmatter = [
    '<!--',
    `  owner: custom`,
    `  name: ${name}`,
    `  author: ${author || ''}`,
    `  created: ${now}`,
    `  updated: ${now}`,
    ...(locked ? ['  locked: true'] : []),
    '-->'
  ].join('\n');

  const content = `${frontmatter}\n`;

  const pageDir = dirname(filePath);
  await mkdir(pageDir, { recursive: true });
  await writeFile(filePath, content, 'utf-8');

  const relPath = dir ? `${dir}/${slug}` : slug;

  await triggerHook('fragment:created', { file: `${relPath}.fragment.html`, name, slug });

  return [null, { file: `${relPath}.fragment.html`, name, slug }];
};
