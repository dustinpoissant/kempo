import { getRow, saveRow } from './rows.js';
import loadRegistry from './registry.js';
import validateTree from './validateTree.js';
import { listLocations, readPage, renderTrees, writePage } from './pageCore.js';
import { walk } from '../../../src/kempo/sitebuilder/nodes.js';

/*
  Saves what the builder sends: the tree of each visual location, the code of the code locations, and the page's
  settings. `loadedHash` is the hash of the file the editor opened. If the file is not that any more, someone else saved
  or edited it, and this refuses (409) rather than writing over them; the editor then opens the page again, which
  shows the conflict. Saving renders the trees to HTML, writes the file, and stores the trees with the new hash.
*/
export default async ({ rootDir, file, trees, codeBlocks = {}, changes = {}, loadedHash, userId = null }) => {
  const [error, page] = await readPage({ rootDir, file });
  if(error) return [error, null];
  if(!loadedHash || loadedHash !== page.hash){
    return [{ code: 409, msg: 'This page was changed after you opened it. Reload it to see what changed.' }, null];
  }
  if(!trees || typeof trees !== 'object') return [{ code: 400, msg: 'The trees are required' }, null];

  const registry = await loadRegistry();
  const locations = await listLocations({ rootDir, parsed: page.parsed });
  const row = await getRow(file);

  const preserved = new Set();
  for(const nodes of Object.values(row?.trees || {})){
    walk(nodes, node => { if(node.type === 'unknown' && node.attrs?.html) preserved.add(node.attrs.html); });
  }

  const cleaned = {};
  for(const location of locations.filter(candidate => !candidate.code)){
    const [treeError, nodes] = validateTree(trees[location.name] || [], registry, { preserved });
    if(treeError) return [treeError, null];
    cleaned[location.name] = nodes;
  }

  const code = {};
  for(const location of locations.filter(candidate => candidate.code)){
    if(typeof codeBlocks[location.name] === 'string') code[location.name] = codeBlocks[location.name];
  }

  const [writeError, written] = await writePage({
    rootDir,
    file,
    page,
    locations,
    html: renderTrees(cleaned, locations, registry),
    codeBlocks: code,
    changes
  });
  if(writeError) return [writeError, null];

  await saveRow({ file, trees: cleaned, fileHash: written.hash, codeOnly: false, savedBy: userId });
  return [null, { hash: written.hash, updatedAt: written.updatedAt, trees: cleaned }];
};
