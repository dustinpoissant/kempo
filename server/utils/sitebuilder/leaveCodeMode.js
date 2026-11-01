import { getRow, saveRow } from './rows.js';
import loadRegistry from './registry.js';
import validateTree from './validateTree.js';
import openPage from './openPage.js';
import { listLocations, readPage, renderTrees, writePage } from './pageCore.js';

/*
  Takes a code-only page back into the builder, which is a one-way door for what is in the file:

    empty      the page's visual content is wiped and the builder starts from nothing
    lastGood   the last tree the builder had for this page is rendered and written over the content

  The page's code locations (head and scripts) are kept either way. Resolves to the page as it is opened afterwards.
*/
export default async ({ rootDir, file, mode, loadedHash, userId = null }) => {
  if(mode !== 'empty' && mode !== 'lastGood') return [{ code: 400, msg: 'Choose to start over or to use the last good page' }, null];

  const [error, page] = await readPage({ rootDir, file });
  if(error) return [error, null];
  if(!loadedHash || loadedHash !== page.hash) return [{ code: 409, msg: 'This page changed again. Reload it to see what changed.' }, null];

  const registry = await loadRegistry();
  const locations = await listLocations({ rootDir, parsed: page.parsed });
  const row = await getRow(file);

  let trees = Object.fromEntries(locations.filter(location => !location.code).map(location => [location.name, []]));
  if(mode === 'lastGood'){
    const stored = row?.lastGoodTrees || (row && !row.codeOnly ? row.trees : null);
    if(!stored) return [{ code: 404, msg: 'There is no earlier version of this page to start from' }, null];
    for(const location of locations.filter(candidate => !candidate.code)){
      const [treeError, nodes] = validateTree(stored[location.name] || [], registry);
      if(treeError) return [treeError, null];
      trees[location.name] = nodes;
    }
  }

  const [writeError, written] = await writePage({ rootDir, file, page, locations, html: renderTrees(trees, locations, registry) });
  if(writeError) return [writeError, null];
  await saveRow({ file, trees, fileHash: written.hash, codeOnly: false, savedBy: userId });
  return openPage({ rootDir, file, userId });
};
