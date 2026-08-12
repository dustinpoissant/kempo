import { build } from 'esbuild';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { LEXICAL_BASE, LEXICAL_PACKAGES, bundleFileName } from '../server/utils/lexical/packages.js';

/*
  Bundles lexical for the browser so the admin's WYSIWYG does not depend on a CDN at runtime.

  kempo-ui's HtmlEditor imports these packages from `window.kempo.lexicalUrl`, falling back to
  esm.sh. Serving the npm files directly does not work: the published ESM entry reads
  `process.env.NODE_ENV` and `process` does not exist in a browser, the dev and prod builds import
  bare specifiers a browser cannot resolve, and they pull in further packages of their own
  (@lexical/clipboard, @lexical/dragon, @lexical/utils). Bundling resolves all three, which is the
  same job esm.sh does on request.

  Two details matter, and each produces a silently broken editor if got wrong:

    - Entry points must be the ESM build, not the CommonJS one. require.resolve() returns the CJS
      entry, and bundling that to ESM yields a module whose only export is `default`, so every
      named export the editor destructures is undefined and the editor loads but stays empty.

    - Code splitting is required. Bundling each package on its own inlines a private copy of
      lexical's core into all nine, and lexical relies on shared module state and class identity,
      so nodes registered through one package are not recognised by another. Splitting hoists the
      core into a chunk every entry imports, leaving exactly one instance.
*/

/*
  Located by path rather than require.resolve: lexical's exports map does not expose
  ./package.json, so resolving through it throws ERR_PACKAGE_PATH_NOT_EXPORTED.
*/
const NODE_MODULES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'node_modules');

const packageMeta = async pkg => {
  const dir = path.join(NODE_MODULES, ...pkg.split('/'));
  try {
    return { dir, meta: JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8')) };
  } catch {
    throw new Error(`${pkg} is not installed — run npm install`);
  }
};

// The published ESM build, which package.json advertises via `module`
const esmEntry = async pkg => {
  const { dir, meta } = await packageMeta(pkg);
  if(!meta.module) throw new Error(`${pkg} does not advertise an ESM build via "module"`);
  return path.join(dir, meta.module);
};

export default async (outDir) => {
  const targetDir = path.join(outDir, 'vendor', 'lexical');
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  const { meta } = await packageMeta('lexical');
  const version = meta.version;

  const entryPoints = {};
  for(const pkg of LEXICAL_PACKAGES){
    entryPoints[bundleFileName(pkg).replace(/\.js$/, '')] = await esmEntry(pkg);
  }

  const result = await build({
    entryPoints,
    outdir: targetDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    minify: true,
    legalComments: 'none',
    define: { 'process.env.NODE_ENV': '"production"' },
    chunkNames: 'chunks/[name]-[hash]',
    /*
      Absolute chunk references. A scoped package is served at
      /kempo/vendor/lexical/@lexical/rich-text@0.43.0, which has one path segment more than the
      unscoped one, so a relative "./chunks/..." import resolves a directory too deep and 404s.
    */
    publicPath: LEXICAL_BASE,
    metafile: true,
  });

  const outputs = Object.keys(result.metafile.outputs);
  const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);

  /*
    The version these were built from. The middleware compares it against the version in the
    requested URL and warns on a mismatch, so a kempo-ui upgrade that moves LEXICAL_VERSION cannot
    quietly serve a different build than the editor asked for.
  */
  await writeFile(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify({ version, packages: LEXICAL_PACKAGES }, null, 2) + '\n'
  );

  return {
    version,
    count: LEXICAL_PACKAGES.length,
    chunks: outputs.filter(o => o.replace(/\\/g, '/').includes('/chunks/')).length,
    bytes,
  };
};
