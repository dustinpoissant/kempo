import { readFile } from 'fs/promises';
import { relative } from 'path';
import scanDir from '../fs/scanDir.js';
import parseFrontmatter from '../fs/parseFrontmatter.js';
import getSetting from '../settings/getSetting.js';

const RESERVED_KEYS = new Set(['owner', 'name', 'author', 'created', 'updated', 'locked', 'hidden', 'title', 'description']);

/*
  In-memory cache keyed by rootDir.
  TTL is read from the 'system:pages:cacheTtl' setting (milliseconds, default 60000).
*/
const cache = new Map();

const scan = async (rootDir) => {
  const pages = await scanDir(rootDir, rootDir, async (fullPath, entry, root) => {
    const isDisabled = entry.name.endsWith('.page-disabled.html');
    if(entry.isDirectory() || (!entry.name.endsWith('.page.html') && !isDisabled)) return null;
    const content = await readFile(fullPath, 'utf-8');
    const meta = parseFrontmatter(content);
    const pageTitle = content.match(/<page\s[^>]*title="([^"]*)">/);
    if(!meta.title && pageTitle) meta.title = pageTitle[1];
    const relPath = relative(root, fullPath).replace(/\\/g, '/');
    const urlPath = '/' + relPath
      .replace(/\.page-disabled\.html$/, '')
      .replace(/\.page\.html$/, '')
      .replace(/(^|\/)index$/, '$1');
    const extraMetadata = Object.fromEntries(
      Object.entries(meta).filter(([k]) => !RESERVED_KEYS.has(k))
    );
    return {
      file: relPath,
      url: urlPath || '/',
      name: meta.name || meta.title || '',
      title: meta.title || '',
      owner: meta.owner || 'custom',
      locked: meta.locked === 'true',
      hidden: meta.hidden === 'true',
      disabled: isDisabled,
      author: meta.author || '',
      description: meta.description || '',
      createdAt: meta.created || '',
      updatedAt: meta.updated || '',
      extraMetadata
    };
  });

  const scannedAt = Date.now();
  cache.set(rootDir, { pages, scannedAt });
  return scannedAt;
};

export default async ({ rootDir, owner, forceRescan = false, showHidden = true, offset = 0, limit = 0 }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const [, cacheTtl] = await getSetting('system', 'pages:cacheTtl', 60000);
  const cached = cache.get(rootDir);

  if(!forceRescan && cached && (Date.now() - cached.scannedAt < cacheTtl)){
    return [null, buildResult(cached.pages, cached.scannedAt, { owner, showHidden, offset, limit })];
  }

  const scannedAt = await scan(rootDir);
  const { pages } = cache.get(rootDir);
  return [null, buildResult(pages, scannedAt, { owner, showHidden, offset, limit })];
};

const buildResult = (allPages, scannedAt, { owner, showHidden, offset, limit }) => {
  let filtered = showHidden ? allPages : allPages.filter(p => !p.hidden);

  if(owner === 'extension'){
    filtered = filtered.filter(p => p.owner !== 'custom' && p.owner !== 'system');
  } else if(owner){
    filtered = filtered.filter(p => p.owner === owner);
  }

  filtered = filtered.slice().sort((a, b) => {
    const aPath = a.file.replace(/\.page(-disabled)?\.html$/, '');
    const bPath = b.file.replace(/\.page(-disabled)?\.html$/, '');
    const aDir = aPath.includes('/') ? aPath.split('/').slice(0, -1).join('/') : '';
    const bDir = bPath.includes('/') ? bPath.split('/').slice(0, -1).join('/') : '';
    if(aPath === 'index' || aPath === '') return -1;
    if(bPath === 'index' || bPath === '') return 1;
    if(aDir !== bDir){
      if(!aDir) return -1;
      if(!bDir) return 1;
      return aDir.localeCompare(bDir);
    }
    return aPath.localeCompare(bPath);
  });

  const total = filtered.length;
  const pages = limit > 0 ? filtered.slice(offset, offset + limit) : filtered.slice(offset);
  return { pages, total, scannedAt };
};

