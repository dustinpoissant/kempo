import { existsSync } from 'fs';
import { join } from 'path';
import goBackPlan from './goBackPlan.js';
import { readState } from './siteLayout.js';

/*
  The part of the update status that only a site running from a Docker volume has: whether a version is staged and what
  switching to it would change, whether going back is possible now and what it would do (see goBackPlan), whether a switch is still proving
  itself, and how the last switch ended.
*/
export default (siteRoot = process.env.KEMPO_SITE_ROOT) => {
  if(!siteRoot) return { mode: 'in-place' };

  const staged = readState(siteRoot, 'staged');
  const last = readState(siteRoot, 'last');
  const back = goBackPlan(siteRoot);
  return {
    mode: 'release',
    staged: staged && existsSync(join(staged.dir, 'node_modules')) ? { version: staged.version, kempoUpdate: Boolean(staged.kempoUpdate), packages: staged.packages ?? [], plan: staged.plan, preparedAt: staged.preparedAt } : null,
    canGoBack: back.available,
    previousVersion: back.previous?.version ?? null,
    goBack: { available: back.available, reason: back.reason, restoresData: back.restoresData, packages: back.last?.ok && back.last.to === back.version ? back.last.packages ?? [] : [] },
    switching: readState(siteRoot, 'switch')?.status ?? null,
    lastUpdate: last ? { ok: last.ok, from: last.from, to: last.to, packages: last.packages ?? [], reason: last.reason ?? null, breaking: Boolean(last.breaking), at: last.at } : null
  };
};
