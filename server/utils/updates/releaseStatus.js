import { existsSync } from 'fs';
import { join } from 'path';
import { getCurrent, paths, readState } from './siteLayout.js';

/*
  The part of the update status that only a site running from a Docker volume has: whether a version is staged and what
  switching to it would change, whether there is an earlier version to go back to, and how the last switch ended.
*/
export default (siteRoot = process.env.KEMPO_SITE_ROOT) => {
  if(!siteRoot) return { mode: 'in-place' };

  const staged = readState(siteRoot, 'staged');
  const { previous } = getCurrent(siteRoot);
  const last = readState(siteRoot, 'last');
  return {
    mode: 'release',
    staged: staged && existsSync(join(staged.dir, 'node_modules')) ? { version: staged.version, kempoUpdate: Boolean(staged.kempoUpdate), packages: staged.packages ?? [], plan: staged.plan, preparedAt: staged.preparedAt } : null,
    canGoBack: Boolean(previous?.id && existsSync(join(paths(siteRoot).releases, previous.id, 'node_modules'))),
    previousVersion: previous?.version ?? null,
    switching: readState(siteRoot, 'switch')?.status ?? null,
    lastUpdate: last ? { ok: last.ok, from: last.from, to: last.to, packages: last.packages ?? [], reason: last.reason ?? null, breaking: Boolean(last.breaking), at: last.at } : null
  };
};
