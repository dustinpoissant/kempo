import { walk } from '../../../src/kempo/sitebuilder/nodes.js';
import { getRow, saveRow } from './rows.js';
import loadRegistry from './registry.js';
import { analyzeFile, blockContent, listLocations, pageSummary, previewHtml, readPage, renderTrees, treesMatchFile } from './pageCore.js';

/*
  Opens a page for the builder and says what state it is in:

    builder    the page opens from its tree
    code       the builder could not rebuild the page exactly, so it is edited as code
    conflict   the file and the builder's copy disagree, and a person has to choose which to keep

  The page file is what is served, so it is treated as the truth: the stored tree is only what the builder last wrote.
  Opening never changes a page. The one thing it writes is the builder's own row, for a page that has none yet.
*/

/* A stored tree is out of date when it holds a widget nothing knows now, or lacks a location the page has (one that used to hold code). */
const hasMissingTypes = (trees, registry, visual) => {
  let missing = visual.some(location => !Array.isArray(trees?.[location.name]));
  for(const nodes of Object.values(trees || {})){
    walk(nodes, node => { if(!registry.has(node.type)) missing = true; });
  }
  return missing;
};

const hasContent = trees => Object.values(trees || {}).some(nodes => nodes?.length);

export default async ({ rootDir, file, userId = null }) => {
  const [error, page] = await readPage({ rootDir, file });
  if(error) return [error, null];

  const registry = await loadRegistry();
  const locations = await listLocations({ rootDir, parsed: page.parsed });
  const visual = locations.filter(location => !location.code);
  const row = await getRow(file);

  const filled = trees => Object.fromEntries(visual.map(location => [location.name, trees?.[location.name] || []]));
  const base = extra => ({ file, hash: page.hash, page: pageSummary(file, page), locations, savedAt: row?.savedAt || null, ...extra });
  const builder = trees => ({
    ...base({ state: 'builder' }),
    trees: filled(trees),
    codeBlocks: Object.fromEntries(locations.filter(location => location.code).map(location => [location.name, blockContent(page.parsed, location.name)]))
  });
  const code = (reason, lastGood) => ({
    ...base({ state: 'code', reason, hasLastGood: hasContent(lastGood) }),
    blocks: locations.map(location => ({ ...location, location: location.name, content: blockContent(page.parsed, location.name) }))
  });

  const analyze = () => analyzeFile({ parsed: page.parsed, locations, registry });

  /* A page the builder has not seen: take it if it rebuilds exactly, otherwise it is code. */
  const adopt = async (previous, lastGoodTrees) => {
    const analysis = analyze();
    if(analysis.ok){
      await saveRow({ file, trees: analysis.trees, fileHash: page.hash, codeOnly: false, savedBy: userId });
      return builder(analysis.trees);
    }
    await saveRow({ file, trees: {}, fileHash: page.hash, codeOnly: true, lastGoodTrees, savedBy: userId });
    return code(analysis.reason, lastGoodTrees);
  };

  if(!row) return [null, await adopt(null, null)];

  if(row.fileHash === page.hash){
    if(row.codeOnly){
      const analysis = analyze();
      return [null, code(analysis.ok ? '' : analysis.reason, row.lastGoodTrees)];
    }
    if(!hasMissingTypes(row.trees, registry, visual)) return [null, builder(row.trees)];
    return [null, await adopt(row, null)];
  }

  if(row.codeOnly) return [null, await adopt(row, row.lastGoodTrees)];

  if(!hasMissingTypes(row.trees, registry, visual) && treesMatchFile({ parsed: page.parsed, trees: row.trees, locations, registry })){
    await saveRow({ file, trees: row.trees, fileHash: page.hash, codeOnly: false, lastGoodTrees: row.lastGoodTrees, savedBy: row.savedBy });
    return [null, builder(row.trees)];
  }

  const analysis = analyze();
  return [null, {
    ...base({ state: 'conflict' }),
    conflict: {
      rowSavedAt: row.savedAt,
      fileModifiedAt: page.modifiedAt,
      fileRebuildable: analysis.ok,
      fileReason: analysis.ok ? '' : analysis.reason,
      filePreview: previewHtml(Object.fromEntries(visual.map(location => [location.name, blockContent(page.parsed, location.name)])), locations),
      rowPreview: previewHtml(renderTrees(row.trees, locations, registry), locations)
    }
  }];
};
