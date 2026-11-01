import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { renderLocation } from '../../../src/kempo/sitebuilder/render.js';
import listTemplates from '../pages/listTemplates.js';
import triggerHook from '../hooks/triggerHook.js';
import rebuild from './rebuild.js';
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
  const managed = new Set(registry.pageComponents());
  return html.replace(/<script\s+type="module"\s+src="([^"]+)"\s*><\/script>\s*/g, (whole, src) => (managed.has(src) ? '' : whole));
};

const renderContext = registry => ({ registry, editor: false, sanitize: sanitizeMarkup });

export const renderTree = (nodes, registry) => renderLocation(nodes || [], renderContext(registry));

/* The HTML of every visual location for a set of trees: { location: html }. */
export const renderTrees = (trees, locations, registry) => Object.fromEntries(
  locations.filter(location => !location.code).map(location => [location.name, renderTree(trees?.[location.name], registry)])
);

/*
  Can the builder take this file? Every visual location has to rebuild into a tree, the tree has to render back to
  what the file holds, and nothing else may be in the file. Resolves to { ok: true, trees } or { ok: false, reason }.
*/
export const analyzeFile = ({ parsed, locations, registry }) => {
  if(parsed.extra) return { ok: false, reason: 'The page holds something outside its content blocks' };
  const trees = {};
  for(const location of locations.filter(candidate => !candidate.code)){
    const html = blockContent(parsed, location.name);
    const [error, nodes] = rebuild(html, registry);
    if(error) return { ok: false, reason: location.name === 'default' ? error.msg : `${location.label || location.name}: ${error.msg}` };
    const rendered = renderTree(nodes, registry);
    if(!sameMeaning(stripManagedScripts(rendered, registry), stripManagedScripts(html, registry))){
      return { ok: false, reason: `The "${location.name}" content is not exactly what the builder would write` };
    }
    trees[location.name] = nodes;
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
