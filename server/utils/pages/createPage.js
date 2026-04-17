import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const slugify = name => name
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export default async ({ rootDir, directory, name, template, author }) => {
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

  const templateName = template || 'default';

  const now = new Date().toISOString();
  const frontmatter = [
    '<!--',
    `  owner: custom`,
    `  name: ${name}`,
    `  author: ${author || ''}`,
    `  created: ${now}`,
    `  updated: ${now}`,
    '-->'
  ].join('\n');

  const pageContent = `${frontmatter}\n<page template="${templateName}" title="${name}">\n</page>\n`;

  const pageDir = dirname(filePath);
  await mkdir(pageDir, { recursive: true });
  await writeFile(filePath, pageContent, 'utf-8');

  const relPath = (dir ? `${dir}/${slug}` : slug);
  const url = '/' + relPath;

  return [null, { file: `${relPath}.page.html`, url, title: name, slug }];
};
