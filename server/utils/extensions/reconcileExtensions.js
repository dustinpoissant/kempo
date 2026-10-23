import { and, eq } from 'drizzle-orm';
import { join } from 'path';
import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import readKempoConfig from './readKempoConfig.js';
import upgradeExtension from './upgradeExtension.js';
import { compareVersions, isBreakingBump, isVersion } from '../updates/helpers.js';

/*
  Brings every installed extension's database in step with the version on disk. Run when the server starts, so it is the one
  place an update of an extension takes effect, whichever way the new version got there (the Updates screen, a switch of the
  site's code, npm run by hand, an image that was rebuilt). It is what a deploy script would otherwise have to do.

    on disk is newer than the row    upgradeExtension: its tables, update.js and whatever it newly declares
    on disk is older than the row    the site went back: the row says so, and no script runs, so going back is safe
    the same, or not installed       nothing

  The row is claimed first (its version moved to the new one only if it still holds the old), so of several servers starting
  together exactly one upgrades an extension. A failed upgrade gives the row its old version back, so it is tried again at
  the next start, and it is reported rather than stopping the server.

  Extensions are taken in dependency order (what each declares in `dependencies`, in the new version's kempo-config.json), so
  an extension's update script finds the ones it builds on already up to date: kempo-media after kempo-files and kempo-thumbs,
  kempo-commerce after kempo-products and kempo-payments.
*/
let lastRun = { ran: false, upgraded: [], reverted: [], failed: [] };

export const getReconcileResult = () => lastRun;

const isBreaking = (from, to) => isVersion(from) && isVersion(to) && isBreakingBump(from, to);

const newer = (installed, recorded) => (isVersion(installed) && isVersion(recorded) ? compareVersions(installed, recorded) : (installed === recorded ? 0 : 1));

export default async ({ executor = db, root = process.cwd(), upgrade = upgradeExtension } = {}) => {
  const result = { upgraded: [], reverted: [], failed: [] };

  try {
    const found = [];
    for(const row of await executor.select().from(extension)){
      const extRoot = join(root, 'node_modules', row.name);
      try {
        const { pkg, kempo } = await readKempoConfig(extRoot);
        found.push({ row, extRoot, installed: pkg.version, requires: kempo.dependencies ?? row.kempo?.dependencies ?? [] });
      } catch {
        continue;
      }
    }

    const ordered = [];
    const placed = new Set();
    const place = item => {
      if(placed.has(item.row.name)) return;
      placed.add(item.row.name);
      for(const name of item.requires){
        const dependency = found.find(other => other.row.name === name);
        if(dependency) place(dependency);
      }
      ordered.push(item);
    };
    found.forEach(place);

    for(const { row, extRoot, installed } of ordered){
      if(!installed || installed === row.version) continue;

      const direction = row.version ? newer(installed, row.version) : 1;
      if(direction < 0){
        await executor.update(extension).set({ version: installed, updatedAt: new Date() }).where(eq(extension.name, row.name));
        result.reverted.push({ name: row.name, from: row.version, to: installed });
        continue;
      }

      const claim = and(eq(extension.name, row.name), row.version ? eq(extension.version, row.version) : undefined);
      const [claimed] = await executor.update(extension).set({ version: installed }).where(claim).returning({ name: extension.name });
      if(!claimed) continue;

      const [error] = await upgrade({ name: row.name, record: row, extRoot });
      if(error){
        await executor.update(extension).set({ version: row.version }).where(eq(extension.name, row.name));
        result.failed.push({ name: row.name, from: row.version, to: installed, major: isBreaking(row.version, installed), reason: error.msg });
      } else {
        result.upgraded.push({ name: row.name, from: row.version, to: installed });
      }
    }
  } catch(error) {
    return [{ code: 500, msg: `The extensions could not be brought up to date: ${String(error.cause?.message || error.message).slice(0, 300)}` }, result];
  }

  lastRun = { ran: true, ...result };
  return [null, result];
};
