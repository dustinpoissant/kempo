import { PACKAGE, compareVersions } from './helpers.js';
import extensionTargets from './extensionTargets.js';
import { RUNNING_VERSION } from './runtime.js';
import fetchManifest from './fetchManifest.js';
import getInstallInfo from './getInstallInfo.js';
import { installedVersion, npmFailure, runNpm, targetsFor } from './npm.js';
import { restartMode, scheduleRestart } from './restart.js';
import triggerHook from '../hooks/triggerHook.js';
import markHandled from '../notifications/markHandled.js';

let updating = false;
let restarting = false;

/*
  For a site that does not run from a Docker volume (see prepareUpdate for one that does): installs in place.

  Installs a newer version of kempo and/or of installed extensions (`version` null leaves kempo as it is, `extensions` are
  names), then restarts the server so that it runs them, and at that start each extension is brought up to date
  (reconcileExtensions). Without `version` it is the newest kempo. A newer kempo can need newer kempo-server, kempo-ui or kempo-css than the site has, so any peer
  that no longer meets the new version's minimum is updated in the same install. Older versions are refused.

  Returns once the install has finished and the restart is scheduled, a second later, so the caller can answer
  the request first. The rest are for tests.
*/
export default async ({ version = 'latest', extensions = [], cwd = process.cwd(), install = getInstallInfo({ cwd }), run = runNpm, restart = scheduleRestart, fetcher, executor } = {}) => {
  const { canUpdate, reason } = install;
  if(!canUpdate){
    return [{ code: 409, msg: reason }, null];
  }
  if(version === null && !extensions.length){
    return [{ code: 400, msg: 'Choose something to update' }, null];
  }
  if(updating){
    return [{ code: 409, msg: 'An update is already running' }, null];
  }

  updating = true;
  try {
    let manifest = null;
    if(version !== null){
      const [manifestError, found] = await fetchManifest({ version, fetcher });
      if(manifestError) return [manifestError, null];
      if(compareVersions(found.version, RUNNING_VERSION) <= 0){
        return [{ code: 409, msg: `Version ${RUNNING_VERSION} is already running` }, null];
      }
      manifest = found;
    }

    const [targetsError, wanted] = await extensionTargets({ names: extensions, kempoVersion: manifest?.version ?? RUNNING_VERSION, root: cwd, fetcher, ...(executor ? { executor } : {}) });
    if(targetsError) return [targetsError, null];

    const targets = [...(manifest ? targetsFor({ manifest, dir: cwd }) : []), ...wanted.targets];

    try {
      await run(targets, cwd);
    } catch(error) {
      return [{ code: 500, msg: `The update could not be installed: ${npmFailure(error)}` }, null];
    }

    const missing = [...(manifest ? [{ name: PACKAGE, to: manifest.version }] : []), ...wanted.items].find(item => installedVersion(cwd, item.name) !== item.to);
    if(missing){
      return [{ code: 500, msg: `npm finished but ${missing.name} ${missing.to} is not installed` }, null];
    }

    if(manifest){
      await markHandled({ owner: PACKAGE, dedupeKey: `update:${manifest.version}` });
      await triggerHook('kempo:updated', { oldVersion: RUNNING_VERSION, newVersion: manifest.version, packages: targets });
    }
    restarting = true;
    restart();

    return [null, { from: RUNNING_VERSION, to: manifest?.version ?? RUNNING_VERSION, packages: targets, restart: restartMode() }];
  } finally {
    updating = restarting;
  }
};
