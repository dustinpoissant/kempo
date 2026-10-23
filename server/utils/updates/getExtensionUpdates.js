import { join } from 'path';
import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { compareVersions, isBreakingBump, isVersion, lowerBound } from './helpers.js';
import fetchManifest from './fetchManifest.js';
import readKempoConfig from '../extensions/readKempoConfig.js';

/* The last answer npm gave for the installed extensions, kept for the process like the one for kempo itself. */
let known = null;
let checkError = null;

export const resetExtensionUpdates = () => {
  known = null;
  checkError = null;
};

const CONCURRENCY = 4;

const installedVersionOf = async (root, row) => {
  try {
    return (await readKempoConfig(join(root, 'node_modules', row.name))).pkg.version;
  } catch {
    return null;
  }
};

/*
  Asks npm for the newest version of every installed extension, four at a time, and lists those that are newer than what is
  on disk: [{ name, installedVersion, latestVersion, major, kempoRequired }]. `kempoRequired` is the lowest kempo the new
  version asks for, which can be newer than the one running (then it can only be updated together with kempo).
  An extension that is not on npm (a git-only one) or whose answer was an error is left out; if every answer was an
  error, `checkError` says npm could not be reached. Asks when `force` is set or the last answer is older than `maxAgeMs`;
  `offline` never asks.
*/
export default async ({ force = false, offline = false, maxAgeMs = 3600000, fetcher, executor = db, root = process.cwd() } = {}) => {
  if(!offline && (force || !known || Date.now() - known.checkedAt > maxAgeMs)){
    const rows = await executor.select().from(extension);
    const updates = [];
    let failures = 0;
    let next = 0;

    const work = async () => {
      while(next < rows.length){
        const row = rows[next++];
        const installedVersion = await installedVersionOf(root, row);
        if(!isVersion(installedVersion)) continue;
        const [error, manifest] = await fetchManifest({ name: row.name, fetcher });
        if(error){
          if(error.code !== 404) failures++;
          continue;
        }
        if(compareVersions(manifest.version, installedVersion) > 0){
          updates.push({
            name: row.name,
            installedVersion,
            latestVersion: manifest.version,
            major: isBreakingBump(installedVersion, manifest.version),
            kempoRequired: manifest.peerDependencies.kempo ? lowerBound(manifest.peerDependencies.kempo) : null
          });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, work));

    checkError = rows.length && failures === rows.length ? 'npm could not be reached' : null;
    if(!checkError) known = { checkedAt: Date.now(), updates: updates.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  return [null, { updates: known?.updates ?? [], checkedAt: known ? new Date(known.checkedAt).toISOString() : null, checkError }];
};
