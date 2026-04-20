import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const slugify = name => name
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export default async ({ rootDir, directory, name, author, copyFrom }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!name) return [{ code: 400, msg: 'Template name is required' }, null];

  const slug = slugify(name);
  if(!slug) return [{ code: 400, msg: 'Template name must contain valid characters' }, null];

  const dir = directory && directory !== '.' && directory !== '/'
    ? directory.replace(/^\//, '').replace(/\/$/, '')
    : '';
  const filePath = dir
    ? join(rootDir, dir, `${slug}.template.html`)
    : join(rootDir, `${slug}.template.html`);

  if(existsSync(filePath)) return [{ code: 409, msg: 'A template with this name already exists in this location' }, null];

  const now = new Date().toISOString();
  const frontmatter = [
    '<!--',
    `  owner: custom`,
    `  author: ${author || ''}`,
    `  created: ${now}`,
    `  updated: ${now}`,
    '-->'
  ].join('\n');

  let markup;
  if(copyFrom){
    const safeCopy = copyFrom.replace(/\.\./g, '').replace(/^\//, '');
    const copyPath = join(rootDir, safeCopy);
    if(!existsSync(copyPath)) return [{ code: 404, msg: 'Source template not found' }, null];
    const raw = await readFile(copyPath, 'utf-8');
    const frontmatterMatch = raw.match(/^<!--\s*\n[\s\S]*?\n\s*-->\n?/);
    markup = frontmatterMatch ? raw.slice(frontmatterMatch[0].length) : raw;
  } else {
    markup = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <location name="head" />
</head>
<body>
    <location />
    <location name="scripts" />
</body>
</html>
`;
  }

  const pageDir = dirname(filePath);
  await mkdir(pageDir, { recursive: true });
  await writeFile(filePath, `${frontmatter}\n${markup}`, 'utf-8');

  const relPath = dir ? `${dir}/${slug}.template.html` : `${slug}.template.html`;

  return [null, { file: relPath, name, slug }];
};
