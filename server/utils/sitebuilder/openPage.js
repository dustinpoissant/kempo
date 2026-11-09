import { getRow, saveRow } from './rows.js';
import loadRegistry from './registry.js';
import systemPages from '../../../src/kempo/pagebuilder/systemPages.js';
import { adoptFile, blockContent, listLocations, pageSummary, previewHtml, readPage, renderTrees, treesMatchFile } from './pageCore.js';

/*
  Opens a page for the builder and says what state it is in:

    builder    the page opens from its tree
    code       the page holds something outside its content blocks, which the builder cannot keep, so it is edited as code
    conflict   the file and the builder's copy disagree, and a person has to choose which to keep

  The page file is what is served, so it is treated as the truth: the stored tree is only what the builder last wrote.
  A file the builder did not write is taken as it is, as one HTML widget per location, except a page that comes with kempo
  (systemPages.js) that still holds what its widgets render to, which opens as those widgets. Opening never changes a page.
  The one thing it writes is the builder's own row, for a page that has none yet.
*/

export default async ({ rootDir, file, userId = null }) => {
  const [error, page] = await readPage({ rootDir, file });
  if(error) return [error, null];

  const registry = await loadRegistry();
  const locations = await listLocations({ rootDir, parsed: page.parsed });
  const visual = locations.filter(location => !location.code);
  const row = await getRow(file);

  const adopted = adoptFile({ parsed: page.parsed, locations, registry });
  const filled = trees => Object.fromEntries(visual.map(location => [location.name, trees?.[location.name] || adopted.trees?.[location.name] || []]));
  const base = extra => ({ file, hash: page.hash, page: pageSummary(file, page), locations, savedAt: row?.savedAt || null, ...extra });
  const builder = trees => ({
    ...base({ state: 'builder' }),
    trees: filled(trees),
    codeBlocks: Object.fromEntries(locations.filter(location => location.code).map(location => [location.name, blockContent(page.parsed, location.name)]))
  });
  const code = (reason, lastGood) => ({
    ...base({ state: 'code', reason, hasLastGood: Object.values(lastGood || {}).some(nodes => nodes?.length) }),
    blocks: locations.map(location => ({ ...location, location: location.name, content: blockContent(page.parsed, location.name) }))
  });

  /* The widgets of a page that comes with kempo, when the file still holds exactly what they render to, so it opens as them and not as one block of code. */
  const seed = () => {
    const trees = systemPages[file] ? filled(structuredClone(systemPages[file])) : null;
    return trees && adopted.ok && treesMatchFile({ parsed: page.parsed, trees, locations, registry }) ? trees : null;
  };

  /* Whether trees are only the file taken as one HTML widget per location (nothing has been done to the page in the builder). */
  const onlyAdopted = trees => visual.every(location => {
    const nodes = trees?.[location.name] ?? [];
    const expected = adopted.trees?.[location.name] ?? [];
    return nodes.length === expected.length && nodes.every((node, index) => node.type === 'html' && node.attrs?.html === expected[index].attrs?.html);
  });

  /* A page the builder has not made, or whose row is not the file's any more and is not wanted: take the file as it is. */
  const adopt = async lastGoodTrees => {
    const seeded = seed();
    if(seeded){
      await saveRow({ file, trees: seeded, fileHash: page.hash, codeOnly: false, lastGoodTrees, savedBy: userId });
      return builder(seeded);
    }
    if(adopted.ok){
      await saveRow({ file, trees: adopted.trees, fileHash: page.hash, codeOnly: false, savedBy: userId });
      return builder(adopted.trees);
    }
    await saveRow({ file, trees: {}, fileHash: page.hash, codeOnly: true, lastGoodTrees, savedBy: userId });
    return code(adopted.reason, lastGoodTrees);
  };

  if(!row) return [null, await adopt(null)];

  if(row.fileHash === page.hash){
    if(row.codeOnly) return [null, code(adopted.ok ? '' : adopted.reason, row.lastGoodTrees)];
    /* A page that comes with kempo, opened before it had widgets, only has the file as one HTML widget: it gets its widgets now. */
    const upgraded = seed();
    if(upgraded && onlyAdopted(row.trees)){
      await saveRow({ file, trees: upgraded, fileHash: page.hash, codeOnly: false, lastGoodTrees: row.lastGoodTrees, savedBy: row.savedBy });
      return [null, builder(upgraded)];
    }
    /* A location the template has gained since the row was saved starts from what the file holds for it. */
    if(visual.some(location => !Array.isArray(row.trees?.[location.name]))){
      const trees = filled(row.trees);
      await saveRow({ file, trees, fileHash: page.hash, codeOnly: false, lastGoodTrees: row.lastGoodTrees, savedBy: row.savedBy });
      return [null, builder(trees)];
    }
    return [null, builder(row.trees)];
  }

  if(row.codeOnly) return [null, await adopt(row.lastGoodTrees)];

  /* Something outside the content blocks is a change the tree knows nothing about, even when the blocks still match. */
  if(adopted.ok && treesMatchFile({ parsed: page.parsed, trees: filled(row.trees), locations, registry })){
    await saveRow({ file, trees: filled(row.trees), fileHash: page.hash, codeOnly: false, lastGoodTrees: row.lastGoodTrees, savedBy: row.savedBy });
    return [null, builder(row.trees)];
  }

  return [null, {
    ...base({ state: 'conflict' }),
    conflict: {
      rowSavedAt: row.savedAt,
      fileModifiedAt: page.modifiedAt,
      fileRebuildable: adopted.ok,
      fileReason: adopted.ok ? '' : adopted.reason,
      filePreview: previewHtml(Object.fromEntries(visual.map(location => [location.name, blockContent(page.parsed, location.name)])), locations),
      rowPreview: previewHtml(renderTrees(row.trees, locations, registry), locations)
    }
  }];
};
