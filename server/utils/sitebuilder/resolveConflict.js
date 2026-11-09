import { getRow, saveRow } from './rows.js';
import loadRegistry from './registry.js';
import openPage from './openPage.js';
import { adoptFile, listLocations, readPage, renderTrees, writePage } from './pageCore.js';

/*
  Settles a disagreement between a page's file and the builder's copy by keeping one, and saves both sides to match:

    file   the file is taken as it is (one HTML widget per location) and stored. If the page holds something the builder
           cannot keep it becomes code-only, and the tree the builder had is kept as the last known good one.
    row    the builder's tree is rendered and written over the file's content.

  `loadedHash` is the hash of the file the person was shown, so a choice is never applied to a file that changed again.
  Resolves to the page as it is opened afterwards.
*/
export default async ({ rootDir, file, keep, loadedHash, userId = null }) => {
  if(keep !== 'file' && keep !== 'row') return [{ code: 400, msg: 'Choose the file or the builder\'s copy' }, null];

  const [error, page] = await readPage({ rootDir, file });
  if(error) return [error, null];
  if(!loadedHash || loadedHash !== page.hash) return [{ code: 409, msg: 'This page changed again. Reload it to see what changed.' }, null];

  const registry = await loadRegistry();
  const locations = await listLocations({ rootDir, parsed: page.parsed });
  const row = await getRow(file);

  if(keep === 'file'){
    const adopted = adoptFile({ parsed: page.parsed, locations, registry });
    if(adopted.ok){
      await saveRow({ file, trees: adopted.trees, fileHash: page.hash, codeOnly: false, savedBy: userId });
    } else {
      await saveRow({ file, trees: {}, fileHash: page.hash, codeOnly: true, lastGoodTrees: row?.trees || row?.lastGoodTrees || null, savedBy: userId });
    }
    return openPage({ rootDir, file, userId });
  }

  if(!row || row.codeOnly) return [{ code: 409, msg: 'The builder has no copy of this page to keep' }, null];
  const [writeError, written] = await writePage({ rootDir, file, page, locations, html: renderTrees(row.trees, locations, registry) });
  if(writeError) return [writeError, null];
  await saveRow({ file, trees: row.trees, fileHash: written.hash, codeOnly: false, lastGoodTrees: row.lastGoodTrees, savedBy: userId });
  return openPage({ rootDir, file, userId });
};
