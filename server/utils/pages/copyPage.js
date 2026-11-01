import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, normalize, dirname, sep } from 'path';
import { existsSync } from 'fs';
import parseFrontmatter from '../fs/parseFrontmatter.js';
import triggerHook from '../hooks/triggerHook.js';
import { copyRow } from '../sitebuilder/rows.js';
import { hashFile } from '../sitebuilder/pageFile.js';

const isTraversal = path => path.startsWith('..') || path.includes('..' + sep);

/*
  Copies a page to a new file. The copy is a custom page that nobody has locked, so a system page can be copied to be
  changed, and it carries the builder's tree with it. A copy that nothing links to is also how a draft is made: edit
  it, then replace the original with it.
*/
export default async ({ rootDir, file, newFile, author }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!file) return [{ code: 400, msg: 'File path is required' }, null];
  if(!newFile) return [{ code: 400, msg: 'New file path is required' }, null];

  const from = normalize(file);
  const to = normalize(newFile);
  if(isTraversal(from) || isTraversal(to)) return [{ code: 400, msg: 'Invalid file path' }, null];
  if(!to.endsWith('.page.html')) return [{ code: 400, msg: 'The copy must be a .page.html file' }, null];

  const fullFrom = join(rootDir, from);
  const fullTo = join(rootDir, to);
  if(!existsSync(fullFrom)) return [{ code: 404, msg: 'Page not found' }, null];
  if(existsSync(fullTo)) return [{ code: 409, msg: 'A page already exists at the new location' }, null];

  const raw = await readFile(fullFrom, 'utf-8');
  const meta = parseFrontmatter(raw);
  const now = new Date().toISOString();
  const copyMeta = { ...meta, owner: 'custom', created: now, updated: now };
  delete copyMeta.locked;
  if(author) copyMeta.author = author;

  const frontmatter = `<!--\n${Object.entries(copyMeta).map(([key, value]) => `  ${key}: ${value}`).join('\n')}\n-->`;
  const body = raw.replace(/^<!--\s*\n[\s\S]*?\n\s*-->\s*/, '');
  const copy = `${frontmatter}\n${body}`;

  await mkdir(dirname(fullTo), { recursive: true });
  await writeFile(fullTo, copy, 'utf-8');
  await copyRow(from.split(sep).join('/'), to.split(sep).join('/'), hashFile(copy));
  await triggerHook('page:created', { file: to.split(sep).join('/') });

  return [null, { file: to.split(sep).join('/') }];
};
