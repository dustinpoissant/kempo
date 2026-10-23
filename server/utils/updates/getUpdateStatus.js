import { PACKAGE, compareVersions, isBreakingBump } from './helpers.js';
import { RUNNING_VERSION, BOOT_ID } from './runtime.js';
import fetchManifest from './fetchManifest.js';
import getInstallInfo from './getInstallInfo.js';
import { restartMode } from './restart.js';
import releaseStatus from './releaseStatus.js';
import getExtensionUpdates, { resetExtensionUpdates } from './getExtensionUpdates.js';
import { getReconcileResult } from '../extensions/reconcileExtensions.js';
import { getSchemaSyncResult } from '../setup/syncCoreSchema.js';

/* The last answer npm gave, kept for the process so that opening the screen does not ask npm every time. */
let known = null;
let checkError = null;

export const resetUpdateStatus = () => {
  resetExtensionUpdates();
  known = null;
  checkError = null;
};

/*
  Where this site stands: what is running, the newest version on npm and whether it can be installed here.
  Asks npm when `force` is set or the last answer is older than `maxAgeMs`; a failed ask keeps the last
  good answer and reports why in `checkError`. `offline` never asks, for a caller that must answer at once.
*/
export default async ({ force = false, offline = false, maxAgeMs = 3600000, fetcher, install = getInstallInfo(), executor } = {}) => {
  if(!offline && (force || !known || Date.now() - known.checkedAt > maxAgeMs)){
    const [error, manifest] = await fetchManifest({ fetcher });
    if(error){
      checkError = error.msg;
    } else {
      checkError = null;
      known = { latestVersion: manifest.version, checkedAt: Date.now() };
    }
  }

  const [, extensionUpdates] = await getExtensionUpdates({ force, offline, maxAgeMs, fetcher, ...(executor ? { executor } : {}) });
  const latestVersion = known?.latestVersion ?? null;
  const updateAvailable = latestVersion !== null && compareVersions(latestVersion, RUNNING_VERSION) > 0;

  return [null, {
    runningVersion: RUNNING_VERSION,
    bootId: BOOT_ID,
    latestVersion,
    updateAvailable,
    major: updateAvailable && isBreakingBump(RUNNING_VERSION, latestVersion),
    checkedAt: known ? new Date(known.checkedAt).toISOString() : null,
    checkError,
    restart: restartMode(),
    database: getSchemaSyncResult(),
    extensionUpdates,
    extensionsRun: getReconcileResult(),
    ...releaseStatus(),
    npmUrl: `https://www.npmjs.com/package/${PACKAGE}`,
    ...install
  }];
};
