import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { sitebuilderPage } from '../../db/schema.js';

/*
  The builder's row for a page, keyed by the page's file path. Page management (move, copy, disable, enable, delete)
  calls the last four so a row always follows its page, and none of them can stop a page being managed: a site whose
  database has not got the table yet simply has no rows to move.
*/

export const getRow = async file => {
  const [row] = await db.select().from(sitebuilderPage).where(eq(sitebuilderPage.file, file)).limit(1);
  return row || null;
};

export const saveRow = async ({ file, trees, fileHash, codeOnly = false, lastGoodTrees = null, savedBy = null }) => {
  const values = { file, trees, fileHash, codeOnly, lastGoodTrees, savedAt: new Date(), savedBy };
  const { file: key, ...changes } = values;
  const [row] = await db.insert(sitebuilderPage).values(values).onConflictDoUpdate({ target: sitebuilderPage.file, set: changes }).returning();
  return row;
};

const quietly = async work => {
  try {
    await work();
  } catch(error) {
    console.warn(`[sitebuilder] could not update the builder's row: ${error.cause?.message || error.message}`);
  }
};

export const moveRow = (from, to) => quietly(async () => {
  await db.delete(sitebuilderPage).where(eq(sitebuilderPage.file, to));
  await db.update(sitebuilderPage).set({ file: to }).where(eq(sitebuilderPage.file, from));
});

export const deleteRow = file => quietly(async () => {
  await db.delete(sitebuilderPage).where(eq(sitebuilderPage.file, file));
});

/* The copy's row holds the same tree, with the hash of the copy's own file. */
export const copyRow = (from, to, fileHash) => quietly(async () => {
  const row = await getRow(from);
  if(!row) return;
  await saveRow({ file: to, trees: row.trees, fileHash, codeOnly: row.codeOnly, lastGoodTrees: row.lastGoodTrees, savedBy: row.savedBy });
});
