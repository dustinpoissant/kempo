import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { renderPage, collectModules, escapeAttribute } from 'kempo-ui/src/utils/renderPage.js';
import { createNode } from 'kempo-ui/src/utils/pageTree.js';
import listTemplates from '../pages/listTemplates.js';
import triggerHook from '../hooks/triggerHook.js';
import validateTree from './validateTree.js';
import { managedModules, servedUrl } from './registry.js';
import { sameMeaning } from './normalize.js';
import { sanitizeMarkup } from './sanitize.js';
import { CODE_LOCATIONS, MAX_FILE_BYTES, composePageFile, hashFile, parsePageFile } from './pageFile.js';

/*
  What opening, saving, resolving a conflict and leaving code mode all share: reading a page, working out whether the
  builder can take it, rendering trees into page content, and writing the file.
*/

const RESERVED = new Set(['owner', 'name', 'author', 'created', 'updated', 'locked', 'title', 'description']);
const BUILT_IN_VARIABLES = ['year', 'date', 'datetime', 'timestamp'];

export const safePath = file => String(file ?? '').replace(/\.\./g, '').replace(/^\//, '');

export const readPage = async ({ rootDir, file }) => {
  if(!rootDir) return [{ code: 400, msg: 'Root directory is required' }, null];
  if(!file) return [{ code: 400, msg: 'File path is required' }, null];
  if(!/\.page\.html$/.test(file)) return [{ code: 400, msg: 'File must be a .page.html file' }, null];
  const fullPath = join(rootDir, safePath(file));
  if(!existsSync(fullPath)) return [{ code: 404, msg: 'Page not found' }, null];
  const [raw, info] = await Promise.all([readFile(fullPath, 'utf-8'), stat(fullPath)]);
  return [null, { fullPath, raw, parsed: parsePageFile(raw), hash: hashFile(raw), modifiedAt: info.mtime }];
};

/* The locations a page's template has, then any content block the template no longer has. Code ones hold code, not widgets. */
export const listLocations = async ({ rootDir, parsed }) => {
  const [, data] = await listTemplates({ rootDir });
  const template = data?.templates?.find(candidate => candidate.name === parsed.template && !candidate.disabled);
  const declared = (template?.locations || [{ name: 'default', label: null }]).map(location => (typeof location === 'string' ? { name: location, label: null } : location));
  const locations = declared.map(({ name, label }) => ({ name, label: label || null, code: CODE_LOCATIONS.includes(name), orphaned: false }));
  for(const block of parsed.blocks){
    if(!locations.some(location => location.name === block.location)){
      locations.push({ name: block.location, label: null, code: CODE_LOCATIONS.includes(block.location), orphaned: true });
    }
  }
  return locations;
};

export const blockContent = (parsed, location) => parsed.blocks.find(block => block.location === location)?.content || '';

/* Page-side scripts the renderer adds are not part of what a person wrote, so they are left out when comparing. */
export const stripManagedScripts = (html, registry) => {
  const managed = managedModules(registry);
  return html.replace(/<script\s+type="module"\s+src="([^"]+)"\s*><\/script>\s*/g, (whole, src) => (managed.has(src) ? '' : whole));
};

/*
  A tree as the page's HTML: the widgets, then the module scripts their elements need (each once). The tree is cleaned
  by the same rules the editor's save uses first, so what is written never depends on what was stored.
*/
export const renderTree = (nodes, registry) => {
  const [, cleaned] = validateTree(nodes || [], registry);
  const tree = cleaned || [];
  const html = renderPage(tree, registry, { sanitize: sanitizeMarkup });
  const scripts = collectModules(tree, registry).map(url => `<script type="module" src="${escapeAttribute(servedUrl(url))}"></script>`);
  return [html, ...scripts].filter(Boolean).join('\n');
};

/* The HTML of every visual location for a set of trees: { location: html }. */
export const renderTrees = (trees, locations, registry) => Object.fromEntries(
  locations.filter(location => !location.code).map(location => [location.name, renderTree(trees?.[location.name], registry)])
);

/*
  Takes a file the builder has not made as it is: the content of each visual location becomes one HTML widget, written
  back exactly as it is, so nothing in the page is changed or lost and everything in it can be edited in the builder. A
  file that holds something outside its content blocks cannot be kept that way, and resolves to { ok: false, reason }.
  Otherwise { ok: true, trees }.
*/
export const adoptFile = ({ parsed, locations, registry }) => {
  if(parsed.extra) return { ok: false, reason: 'The page holds something outside its content blocks' };
  const trees = {};
  for(const location of locations.filter(candidate => !candidate.code)){
    const html = stripManagedScripts(blockContent(parsed, location.name), registry).trim();
    trees[location.name] = html ? [createNode('html', { html })] : [];
  }
  return { ok: true, trees };
};

/* Whether the file's visual content already means what these trees render to. */
export const treesMatchFile = ({ parsed, trees, locations, registry }) => locations
  .filter(location => !location.code)
  .every(location => sameMeaning(
    stripManagedScripts(renderTree(trees?.[location.name], registry), registry),
    stripManagedScripts(blockContent(parsed, location.name), registry)
  ));

export const pageSummary = (file, { parsed }) => {
  const { meta, pageAttributes } = parsed;
  const { template, title, ...variables } = pageAttributes;
  return {
    file,
    name: meta.name || '',
    title: title || meta.title || '',
    template: template || 'default',
    owner: meta.owner || 'custom',
    locked: meta.locked === 'true',
    author: meta.author || '',
    description: meta.description || '',
    createdAt: meta.created || '',
    updatedAt: meta.updated || '',
    extraMetadata: Object.fromEntries(Object.entries(meta).filter(([key]) => !RESERVED.has(key))),
    variables: [...new Set([...BUILT_IN_VARIABLES, 'title', ...Object.keys(variables)])]
  };
};

/*
  Writes the page file. `html` holds the new content of visual locations (by name), `codeBlocks` the new content of
  code locations; whatever is not given stays as it is. `changes` may carry name, title, description and template.
  Resolves to [null, { raw, hash, updatedAt }].
*/
export const writePage = async ({ rootDir, file, page, locations, html = {}, codeBlocks = {}, changes = {} }) => {
  const { parsed } = page;
  const now = new Date().toISOString();
  const system = (parsed.meta.owner || 'custom') === 'system';
  const meta = { ...parsed.meta, updated: now };
  if(!system && changes.name !== undefined) meta.name = String(changes.name);
  if(!system && changes.description !== undefined) meta.description = String(changes.description);
  if(changes.title !== undefined) meta.title = String(changes.title);
  const { template: oldTemplate, title: oldTitle, ...rest } = parsed.pageAttributes;
  const pageAttributes = {
    template: changes.template !== undefined ? String(changes.template) : (oldTemplate || 'default'),
    title: changes.title !== undefined ? String(changes.title) : (oldTitle ?? ''),
    ...rest
  };
  const blocks = locations.map(location => ({
    location: location.name,
    content: location.code
      ? (codeBlocks[location.name] ?? blockContent(parsed, location.name))
      : (html[location.name] ?? blockContent(parsed, location.name))
  }));
  const raw = composePageFile({ meta, pageAttributes, blocks });
  if(Buffer.byteLength(raw) > MAX_FILE_BYTES) return [{ code: 413, msg: 'The page is too large' }, null];
  await writeFile(join(rootDir, safePath(file)), raw, 'utf-8');
  await triggerHook('page:updated', { file: safePath(file), updatedAt: now });
  return [null, { raw, hash: hashFile(raw), updatedAt: now }];
};

/* The preview of a version of a page: all its visual content, in the order of the template. */
export const previewHtml = (html, locations) => locations
  .filter(location => !location.code)
  .map(location => html[location.name] || '')
  .filter(Boolean)
  .join('\n');
