import { readdir } from 'fs/promises';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getEnabledExtensions } from '../extensions/scopeCache.js';
import { normalizeScopes } from '../extensions/scopes.js';

const KEMPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const NODE_MODULES = join(process.cwd(), 'node_modules');

const kempoUiIconsDir = () => {
  try {
    return join(dirname(createRequire(import.meta.url).resolve('kempo-ui/package.json')), 'icons');
  } catch {
    return null;
  }
};

const titleOf = name => {
  const words = name.replace(/[-_]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const shortNameOf = name => titleOf(name.replace(/^kempo-/, ''));

/*
  Every folder an icon can live in, with the address it is served at. Kempo's own sets come first, then the site's
  public icons, then each enabled extension's public icons (under each scope it claims) and admin icons.
*/
const sourcesOf = ({ rootDir, extensions, kempoRoot, kempoUiDir }) => {
  const sources = [
    { id: 'site', label: 'Site', dir: join(rootDir, 'icons'), url: '/icons' },
    { id: 'kempo', label: 'Kempo', dir: join(kempoRoot, 'src', 'kempo', 'icons'), url: '/kempo/icons' },
    { id: 'kempo-admin', label: 'Kempo admin', dir: join(kempoRoot, 'src', 'admin', 'icons'), url: '/admin/icons' }
  ];
  if(kempoUiDir){
    sources.push({ id: 'kempo-ui', label: 'Kempo UI', dir: kempoUiDir, url: '/kempo-ui/icons' });
  }
  for(const row of extensions){
    const [error, scopes] = normalizeScopes(row.kempo ?? {});
    for(const { scope, dir } of error ? [] : scopes){
      sources.push({ id: `${row.name}:${scope}`, label: shortNameOf(row.name), dir: join(NODE_MODULES, row.name, dir, 'icons'), url: `/${scope}/icons` });
    }
    sources.push({ id: `${row.name}:admin`, label: `${shortNameOf(row.name)} admin`, dir: join(NODE_MODULES, row.name, 'admin', 'icons'), url: `/admin/extension/${row.name}/icons` });
  }
  return sources;
};

const readSource = async source => {
  let files;
  try {
    files = await readdir(source.dir);
  } catch {
    return [];
  }
  return files
    .filter(file => file.toLowerCase().endsWith('.svg'))
    .sort()
    .map(file => {
      const name = file.slice(0, -4);
      return { name, label: titleOf(name), src: `${source.url}/${file}`, source: source.id, sourceLabel: source.label };
    });
};

const matches = (icon, needle, source) => (!source || icon.source === source) && (!needle || icon.name.toLowerCase().includes(needle) || icon.label.toLowerCase().includes(needle));

/*
  The icons a site can use: `{ icons, sources }`, each icon `{ name, label, src, source, sourceLabel }`, where `src`
  is the address to put in an icon attribute or `<k-icon src>`. `query` matches part of a name; `source` limits the list to
  one source's id. `rootDir` is the site's public folder; `extensions` defaults to the enabled extensions.
*/
export default async ({ rootDir = join(process.cwd(), 'public'), query = '', source = '', extensions, kempoRoot = KEMPO_ROOT, kempoUiDir = kempoUiIconsDir() } = {}) => {
  const installed = extensions ?? await getEnabledExtensions();
  const sources = sourcesOf({ rootDir, extensions: installed, kempoRoot, kempoUiDir });
  const found = (await Promise.all(sources.map(readSource))).flat();
  const needle = String(query).trim().toLowerCase();
  const icons = found
    .filter(icon => matches(icon, needle, source))
    .sort((a, b) => a.label.localeCompare(b.label) || a.sourceLabel.localeCompare(b.sourceLabel));
  const withIcons = sources.filter(({ id }) => found.some(icon => icon.source === id));
  return [null, { icons, sources: withIcons.map(({ id, label }) => ({ id, label })) }];
};
