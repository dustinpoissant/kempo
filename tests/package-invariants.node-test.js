import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';

/*
  Static checks for the packaging mistakes that do not surface until something else breaks.

  Each of these corresponds to a bug that actually shipped: a package depending on itself, a
  dependency imported everywhere but never declared (which only resolved because a build step
  copied the package somewhere it got hoisted), a file: specifier committed into a manifest, and
  relative imports climbing the wrong number of directories.

  The module-graph suite catches an unresolvable import only for modules it can load, which
  excludes every browser module. These run over the source text instead, so src/admin and
  src/kempo/components are covered too.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
  app-public/, app-server/ and app-templates/ are scaffolding copied into a consumer project. Their
  imports resolve against that project, not this one, so they are not checked here.
*/
const SOURCE_DIRS = ['src', 'server', 'middleware', 'bin', 'scripts', 'tests'];

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const declared = new Set(
  DEPENDENCY_FIELDS.flatMap(field => Object.keys(pkg[field] || {}))
);

const builtins = new Set(builtinModules);

/*
  How the absolute URLs the browser requests map back onto files in this checkout. These mirror the
  consumer's customRoutes plus the admin routing in middleware/kempo.js. Longest prefix first, so
  /kempo-ui/icons/ wins over /kempo-ui/. Own code is checked against src/ first and dist/ second so
  the suite works whether or not a build has run.
*/
const BROWSER_ROUTES = [
  ['/kempo-ui/icons/', ['node_modules/kempo-ui/icons']],
  ['/kempo-ui/', ['node_modules/kempo-ui/dist']],
  ['/kempo-css/', ['node_modules/kempo-css/dist']],
  ['/monaco-editor/', ['node_modules/monaco-editor/min']],
  ['/kempo/', ['src/kempo', 'dist/kempo']],
  ['/admin/', ['src/admin', 'dist/admin']],
];

const walk = async (dir, extensions = ['.js']) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for(const entry of entries){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()){
      files.push(...await walk(full, extensions));
    } else if(extensions.some(ext => entry.name.endsWith(ext))){
      files.push(full);
    }
  }
  return files;
};

const files = (await Promise.all(SOURCE_DIRS.map(d => walk(path.join(root, d))))).flat();

// Commented-out imports are still imports as far as a regex is concerned
const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/*
  Matches `from '…'`, `import '…'` and `import('…')`. The lookbehind keeps method calls that happen
  to end in those words — Buffer.from('…') above all — from being read as imports.
*/
const SPECIFIER = /(?<![.\w])(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

const specifiersFor = source => [...stripComments(source).matchAll(SPECIFIER)].map(m => m[1]);

const packageNameOf = specifier => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

const sources = new Map(
  await Promise.all(files.map(async f => [f, await readFile(f, 'utf8')]))
);

const rel = file => path.relative(root, file).replace(/\\/g, '/');

export default {
  'no dependency is declared with a file: or link: specifier': async ({ pass, fail }) => {
    const offenders = [];
    for(const field of DEPENDENCY_FIELDS){
      for(const [name, spec] of Object.entries(pkg[field] || {})){
        if(typeof spec === 'string' && /^(file|link):/.test(spec)){
          offenders.push(`${field}.${name} = "${spec}"`);
        }
      }
    }
    if(offenders.length){
      return fail(`a local path was committed into package.json, which encodes one machine's directory layout and leaves every other checkout with a dangling symlink — use \`npm run link:local\` instead:\n    ${offenders.join('\n    ')}`);
    }
    pass();
  },

  'the package does not depend on itself': async ({ pass, fail }) => {
    const offenders = DEPENDENCY_FIELDS
      .filter(field => pkg[field]?.[pkg.name])
      .map(field => `${field}.${pkg.name} = "${pkg[field][pkg.name]}"`);
    if(offenders.length){
      return fail(`${pkg.name} lists itself as a dependency:\n    ${offenders.join('\n    ')}`);
    }
    pass();
  },

  'every imported package is declared in package.json': async ({ pass, fail }) => {
    const missing = new Map();
    for(const [file, source] of sources){
      for(const specifier of specifiersFor(source)){
        // Relative paths, absolute browser URLs and remote modules are not package imports
        if(/^[./]/.test(specifier) || /^[a-z]+:/i.test(specifier)) continue;
        const name = packageNameOf(specifier);
        if(builtins.has(name) || declared.has(name)) continue;
        if(!missing.has(name)) missing.set(name, new Set());
        missing.get(name).add(rel(file));
      }
    }
    if(missing.size){
      const detail = [...missing].map(([name, users]) =>
        `${name} — imported by ${[...users].slice(0, 3).join(', ')}${users.size > 3 ? ` (+${users.size - 3} more)` : ''}`
      );
      return fail(`imported but not declared, so it only resolves by luck of hoisting:\n    ${detail.join('\n    ')}`);
    }
    pass();
  },

  'every relative import resolves to a file that exists': async ({ pass, fail }) => {
    const broken = [];
    for(const [file, source] of sources){
      for(const specifier of specifiersFor(source)){
        if(!specifier.startsWith('.')) continue;
        const target = path.resolve(path.dirname(file), specifier);
        if(existsSync(target)) continue;
        if(existsSync(`${target}.js`)) continue;
        if(existsSync(path.join(target, 'index.js'))) continue;
        broken.push(`${rel(file)}\n      -> ${specifier}`);
      }
    }
    if(broken.length){
      return fail(`relative imports that do not resolve (usually the wrong number of ../ segments):\n    ${broken.join('\n    ')}`);
    }
    pass();
  },

  'every absolute browser URL resolves to a file that ships': async ({ pass, fail }) => {
    if(!existsSync(path.join(root, 'node_modules', 'kempo-ui', 'dist'))){
      return fail('kempo-ui is not installed, so /kempo-ui/** cannot be checked — run npm install');
    }

    const htmlFiles = (await Promise.all(
      SOURCE_DIRS.map(d => walk(path.join(root, d), ['.html']))
    )).flat();

    const references = [];

    for(const [file, source] of sources){
      for(const specifier of specifiersFor(source)){
        if(specifier.startsWith('/')) references.push([file, specifier]);
      }
    }

    // The outage this guards was almost entirely <script src>, not JS imports
    for(const file of htmlFiles){
      const source = await readFile(file, 'utf8');
      for(const m of source.matchAll(/(?:src|href)="(\/[^"]+)"/g)){
        references.push([file, m[1]]);
      }
    }

    const broken = [];
    for(const [file, specifier] of references){
      const url = specifier.split(/[?#]/)[0];
      /*
        Only static assets are checked. Links like /admin/extension/<name>/ are navigation to a
        dynamic route, not a file on disk, and are recognised by having no extension.
      */
      if(!path.basename(url).includes('.')) continue;
      const route = BROWSER_ROUTES.find(([prefix]) => url.startsWith(prefix));
      // Unmapped prefixes are the consumer's own public/ files, which do not exist in this repo
      if(!route) continue;
      const [prefix, roots] = route;
      const rest = url.slice(prefix.length);
      if(roots.some(r => existsSync(path.join(root, r, rest)))) continue;
      broken.push(`${rel(file)}\n      -> ${url}   (looked in ${roots.join(', ')})`);
    }

    if(broken.length){
      return fail(`absolute browser URLs that 404 at runtime. These fail silently — a module that does not load never defines its custom element, so the component simply renders nothing:\n    ${[...new Set(broken)].join('\n    ')}`);
    }
    pass();
  },
};
