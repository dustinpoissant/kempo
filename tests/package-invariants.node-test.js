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

const walk = async dir => {
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
      files.push(...await walk(full));
    } else if(entry.name.endsWith('.js')){
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
};
