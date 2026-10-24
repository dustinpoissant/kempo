import { rmSync } from 'fs';
import { join } from 'path';
import { compareVersions } from './helpers.js';
import { PACKAGE_ROOT, RUNNING_VERSION } from './runtime.js';
import extensionTargets, { extensionPlan } from './extensionTargets.js';
import fetchManifest from './fetchManifest.js';
import getInstallInfo from './getInstallInfo.js';
import { installedVersion, npmFailure, runNpm, targetsFor } from './npm.js';
import { paths, stage, writeState } from './siteLayout.js';
import { forcedFiles, planStarterFiles } from './starterFiles.js';
import { pendingUpgrades } from '../setup/runUpgrades.js';

let preparing = false;

const NO_FILES = { add: [], update: [], current: [], edited: [], deleted: [], forced: [] };

/*
  What switching to a staged version would change besides the code, worked out from the staged copy: for kempo, the starter
  files it would replace, add, keep (edited) or need confirmation for, and the data migrations it carries; for each updated
  extension, what it adds and whether it is breaking. `breaking` is true when anything in it can only be undone from a backup.
*/
export const buildPlan = async ({ cwd, oldRoot, newRoot, extensions = [], executor }) => {
  const files = newRoot ? planStarterFiles({ cwd, oldRoot, newRoot, forced: forcedFiles(newRoot) }) : NO_FILES;
  const upgrades = newRoot ? await pendingUpgrades({ dir: join(newRoot, 'server', 'db', 'upgrades'), ...(executor ? { executor } : {}) }) : [];
  return { files, upgrades, extensions, breaking: upgrades.some(upgrade => upgrade.breaking) || extensions.some(extension => extension.breaking) };
};

/*
  Installs newer versions of kempo and/or of installed extensions into a staging folder next to the running site, which keeps
  running from its own files, and works out what switching to them would change. Nothing the site uses is touched, so it
  can fail, or be abandoned, without a trace. Applying it is applyStagedUpdate. Only for a site that runs from a Docker
  volume (KEMPO_SITE_ROOT); any other site is updated in place, by applyUpdate.

  `version` is the kempo version, "latest" by default, or null to leave kempo as it is; `extensions` are names. All are
  installed in one npm run so they are consistent with each other. Resolves to [error, { version, packages, plan }]. `run`,
  `install`, `oldRoot`, `fetcher` and `executor` are for tests.
*/
export default async ({ version = 'latest', extensions = [], siteRoot = process.env.KEMPO_SITE_ROOT, cwd = process.cwd(), oldRoot = PACKAGE_ROOT, install = getInstallInfo({ cwd }), run = runNpm, fetcher, executor } = {}) => {
  if(!siteRoot){
    return [{ code: 409, msg: 'This site is not set up to prepare an update ahead of switching to it' }, null];
  }
  if(!install.canUpdate){
    return [{ code: 409, msg: install.reason }, null];
  }
  if(version === null && !extensions.length){
    return [{ code: 400, msg: 'Choose something to update' }, null];
  }
  if(preparing){
    return [{ code: 409, msg: 'An update is already being prepared' }, null];
  }

  preparing = true;
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

    const kempoVersion = manifest?.version ?? RUNNING_VERSION;
    const [targetsError, wanted] = await extensionTargets({ names: extensions, kempoVersion, root: cwd, fetcher, ...(executor ? { executor } : {}) });
    if(targetsError) return [targetsError, null];

    let staged;
    try {
      staged = stage({ siteRoot, version: kempoVersion });
    } catch(error) {
      return [{ code: 500, msg: `Space for the new version could not be made: ${error.message}` }, null];
    }

    const discard = () => rmSync(paths(siteRoot).staging, { recursive: true, force: true });
    const targets = [...(manifest ? targetsFor({ manifest, dir: staged.dir }) : []), ...wanted.targets];
    try {
      await run(targets, staged.dir);
    } catch(error) {
      discard();
      return [{ code: 500, msg: `The update could not be downloaded: ${npmFailure(error)}` }, null];
    }

    const missing = [...(manifest ? [{ name: 'kempo', to: manifest.version }] : []), ...wanted.items].find(item => installedVersion(staged.dir, item.name) !== item.to);
    if(missing){
      discard();
      return [{ code: 500, msg: `npm finished but ${missing.name} ${missing.to} is not in the staged copy` }, null];
    }

    const [planError, extensionEntries] = await extensionPlan({ dir: staged.dir, items: wanted.items, executor });
    if(planError){
      discard();
      return [planError, null];
    }

    let plan;
    try {
      plan = await buildPlan({ cwd, oldRoot, newRoot: manifest ? join(staged.dir, 'node_modules', 'kempo') : null, extensions: extensionEntries, executor });
    } catch(error) {
      discard();
      return [{ code: 500, msg: `What this update would change could not be worked out: ${error.message}` }, null];
    }

    writeState(siteRoot, 'staged', { id: staged.id, dir: staged.dir, basis: staged.basis, version: kempoVersion, kempoUpdate: Boolean(manifest), from: RUNNING_VERSION, packages: targets, plan, preparedAt: new Date().toISOString() });
    return [null, { version: kempoVersion, kempoUpdate: Boolean(manifest), packages: targets, plan }];
  } finally {
    preparing = false;
  }
};
