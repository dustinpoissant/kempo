import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

/*
  Writes the page files in app-public from the widget trees in src/kempo/pagebuilder/systemPages.js, so each file is exactly
  what its tree renders to and opens in the page builder as those widgets. Run it after changing a tree:

    npm run build:pages

  It keeps each page's frontmatter and attributes, and replaces the content blocks. The pages are not meant to be edited by
  hand; edit the tree.
*/
process.env.KEMPO_DB ??= 'pglite';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const rootDir = join(root, 'app-public');

const { default: systemPages } = await import('../src/kempo/pagebuilder/systemPages.js');
const { default: loadRegistry } = await import('../server/utils/sitebuilder/registry.js');
const { listLocations, renderTrees, blockContent } = await import('../server/utils/sitebuilder/pageCore.js');
const { composePageFile, parsePageFile } = await import('../server/utils/sitebuilder/pageFile.js');

const registry = await loadRegistry();

for(const [file, trees] of Object.entries(systemPages)){
  const raw = await readFile(join(rootDir, file), 'utf-8');
  const parsed = parsePageFile(raw);
  const locations = await listLocations({ rootDir, parsed });
  const html = renderTrees(trees, locations, registry);
  const blocks = locations.map(location => ({
    location: location.name,
    content: location.code ? blockContent(parsed, location.name) : (html[location.name] ?? ''),
  }));
  await writeFile(join(rootDir, file), composePageFile({ meta: parsed.meta, pageAttributes: parsed.pageAttributes, blocks }), 'utf-8');
  console.log(`wrote ${file}`);

  /*
    A page in a [token] folder has a pre-rendered index.html beside it, and the server serves that one first. Its content
    and scripts are replaced with the page's, so the link pages are the widgets too; its navigation and head stay as they are.
  */
  const staticFile = file.replace(/index\.page\.html$/, 'index.html');
  if(file.includes('[token]') && existsSync(join(rootDir, staticFile))){
    const rendered = await readFile(join(rootDir, staticFile), 'utf-8');
    const start = rendered.search(/<main[^>]*>/);
    const mainEnd = rendered.indexOf('</main>') + '</main>'.length;
    const scriptsStart = rendered.indexOf('<script', mainEnd);
    const end = rendered.lastIndexOf('</body>');
    const refreshed = `${rendered.slice(0, start)}<main id="main">
${html.default}
	</main>
${rendered.slice(mainEnd, scriptsStart === -1 ? end : scriptsStart).replace(/^\s+$/, '')}
${rendered.slice(end)}`;
    await writeFile(join(rootDir, staticFile), refreshed, 'utf-8');
    console.log(`wrote ${staticFile}`);
  }
}

process.exit(0);
