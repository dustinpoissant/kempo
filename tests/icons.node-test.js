import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

/*
  The icon picker's list and the icon setting. The list is what a person can choose from, so it must find every
  folder an icon can live in and send only SVG files; the attribute must keep a path on this site and nothing else,
  because the value goes into an image address.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async file => import(pathToFileURL(path.join(root, file)).href);

const validateTree = (await load('server/utils/sitebuilder/validateTree.js')).default;
const { default: loadRegistry } = await load('server/utils/sitebuilder/registry.js');
const listIcons = (await load('server/utils/icons/listIcons.js')).default;

const fixture = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kempo-icons-'));
  const site = path.join(dir, 'public', 'icons');
  const kempo = path.join(dir, 'kempo', 'src', 'kempo', 'icons');
  const admin = path.join(dir, 'kempo', 'src', 'admin', 'icons');
  const ui = path.join(dir, 'kempo-ui', 'icons');
  for(const folder of [site, kempo, admin, ui]){
    await mkdir(folder, { recursive: true });
  }
  await writeFile(path.join(site, 'store.svg'), '<svg></svg>');
  await writeFile(path.join(site, 'notes.txt'), 'not an icon');
  await writeFile(path.join(kempo, 'archive.svg'), '<svg></svg>');
  await writeFile(path.join(admin, 'browse.svg'), '<svg></svg>');
  await writeFile(path.join(ui, 'add.svg'), '<svg></svg>');
  await writeFile(path.join(ui, 'close-circle.svg'), '<svg></svg>');
  return { dir, scan: options => listIcons({ rootDir: path.join(dir, 'public'), kempoRoot: path.join(dir, 'kempo'), kempoUiDir: ui, extensions: [], ...options }) };
};

export default {
  'an icon setting is kept only as a name or as the path of an SVG file on this site': async ({ pass, fail }) => {
    const registry = await loadRegistry();
    const clean = value => validateTree([{ id: 'i', type: 'button', attrs: { label: 'x', icon: value }, slots: {} }], registry)[1]?.[0]?.attrs?.icon;
    const kept = ['add', 'src:/kempo-ui/icons/add.svg', 'src:/admin/extension/kempo-commerce/icons/receipt.svg', 'src:/commerce/icons/shopping_cart.svg'];
    const refused = ['javascript:alert(1)', 'src://evil.example/x.svg', 'src:https://example.com/x.svg', 'src:/icons/../secret.svg', 'src:/icons/x.png', 'src:/icons/a b.svg', 'src:/icons/x.svg"onload=1', 'a b'];
    for(const value of kept){
      if(clean(value) !== value) return fail(`${value} should be kept`);
    }
    for(const value of refused){
      if(clean(value) !== '') return fail(`${value} should be refused, got ${clean(value)}`);
    }
    pass('');
  },

  'the list finds the site, kempo, kempo-ui and admin icons and only SVG files': async ({ pass, fail }) => {
    const { dir, scan } = await fixture();
    try {
      const [error, result] = await scan();
      if(error) return fail(error.msg);
      const srcs = result.icons.map(icon => icon.src).sort();
      const expected = ['/admin/icons/browse.svg', '/icons/store.svg', '/kempo-ui/icons/add.svg', '/kempo-ui/icons/close-circle.svg', '/kempo/icons/archive.svg'];
      if(JSON.stringify(srcs) !== JSON.stringify(expected)) return fail(JSON.stringify(srcs));
      const close = result.icons.find(icon => icon.name === 'close-circle');
      if(close.label !== 'Close circle' || close.sourceLabel !== 'Kempo UI') return fail(JSON.stringify(close));
      pass('');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },

  'the list can be narrowed by a name and by a source': async ({ pass, fail }) => {
    const { dir, scan } = await fixture();
    try {
      const [, byName] = await scan({ query: 'CIRCLE' });
      if(byName.icons.length !== 1 || byName.icons[0].name !== 'close-circle') return fail(JSON.stringify(byName.icons));
      const [, bySource] = await scan({ source: 'site' });
      if(bySource.icons.length !== 1 || bySource.icons[0].src !== '/icons/store.svg') return fail(JSON.stringify(bySource.icons));
      const ids = (await scan()).at(1).sources.map(source => source.id);
      if(!ids.includes('site') || !ids.includes('kempo-ui')) return fail(JSON.stringify(ids));
      pass('');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
};
