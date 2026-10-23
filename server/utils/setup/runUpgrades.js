import { existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { upgrade } from '../../db/schema.js';

/*
  Kempo's own data migrations: the files in server/db/upgrades, which restructure or move data that the additive sync of
  the tables (syncCoreSchema) cannot. See that folder's README for how to write one.

  They run in file-name order, each once, in a transaction, when the server starts and after the tables are in step. A
  database that has never had the `upgrade` table is taken to already hold what the shipped migrations make (a new site,
  or a site on its first version with this): they are recorded as run without being run, under a row called 'baseline'.
*/
export const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'upgrades');

const filesIn = dir => (existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.js')).sort() : []);

const load = (dir, file) => import(`${pathToFileURL(join(dir, file)).href}?t=${Date.now()}`);

const appliedIds = async executor => new Set((await executor.select({ id: upgrade.id }).from(upgrade)).map(row => row.id));

/*
  What would run, in order, as [{ id, description, breaking }]. `dir` is another version's folder, to look ahead at an
  update before it is switched to. Nothing is run or recorded.
*/
export const pendingUpgrades = async ({ dir = DEFAULT_DIR, executor = db } = {}) => {
  const applied = await appliedIds(executor);
  if(!applied.has('baseline')) return [];
  const pending = [];
  for(const file of filesIn(dir).filter(name => !applied.has(name))){
    const { meta = {} } = await load(dir, file);
    pending.push({ id: file, description: meta.description ?? '', breaking: Boolean(meta.breaking) });
  }
  return pending;
};

/*
  Resolves to [error, { ran }]. An error is the first migration that failed, with `breaking` saying whether it was one the
  previous version cannot run without; nothing after it runs, and what it did is rolled back.
*/
export default async ({ dir = DEFAULT_DIR, executor = db } = {}) => {
  try {
    const applied = await appliedIds(executor);
    if(!applied.has('baseline')){
      await executor.transaction(async tx => {
        for(const id of [...filesIn(dir), 'baseline']) await tx.insert(upgrade).values({ id, description: id === 'baseline' ? 'Existing migrations were already part of this database' : 'Part of the baseline' }).onConflictDoNothing();
      });
      return [null, { ran: [] }];
    }

    const ran = [];
    for(const file of filesIn(dir).filter(name => !applied.has(name))){
      const { meta = {}, up } = await load(dir, file);
      try {
        await executor.transaction(async tx => {
          await up({ db: tx, sql });
          await tx.insert(upgrade).values({ id: file, description: meta.description ?? null, breaking: Boolean(meta.breaking) });
        });
        ran.push(file);
      } catch(error) {
        return [{ code: 500, msg: `The data migration ${file} failed: ${String(error.cause?.message || error.message).slice(0, 300)}`, breaking: Boolean(meta.breaking), id: file }, { ran }];
      }
    }
    return [null, { ran }];
  } catch(error) {
    return [{ code: 500, msg: `The data migrations could not be checked: ${String(error.cause?.message || error.message).slice(0, 300)}`, breaking: false }, null];
  }
};
