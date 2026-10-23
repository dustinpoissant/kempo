import { join } from 'path';
import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { compareVersions, isBreakingBump, isVersion, lowerBound } from './helpers.js';
import fetchManifest from './fetchManifest.js';
import { installedVersion } from './npm.js';
import readKempoConfig from '../extensions/readKempoConfig.js';
import checkClaims from '../extensions/checkClaims.js';
import { normalizeAliases } from '../extensions/aliases.js';
import { normalizeScopes, scopeNames } from '../extensions/scopes.js';
import { NAME_PATTERN } from '../extensions/marketplaceClient.js';

/*
  Checks a set of extension updates against npm and the site, and says what to install: for each name, that it is installed,
  that npm has a newer version, and that the new version does not need a newer kempo than the one that will be running
  (`kempoVersion`: the one being installed alongside, or the one running). Nothing is installed here.

  Resolves to [error, { targets, items }] where `targets` are `name@version` for npm and each item is
  { name, row, from, to, major }. The first problem is the error, with the extension's name in it.
*/
export default async ({ names, kempoVersion, executor = db, root = process.cwd(), fetcher }) => {
  const items = [];
  const targets = [];

  for(const name of [...new Set(names)]){
    if(typeof name !== 'string' || !NAME_PATTERN.test(name)){
      return [{ code: 400, msg: `"${name}" is not a valid extension name` }, null];
    }
    const [row] = await executor.select().from(extension).where(eq(extension.name, name)).limit(1);
    if(!row){
      return [{ code: 404, msg: `${name} is not installed` }, null];
    }

    const [error, manifest] = await fetchManifest({ name, fetcher });
    if(error) return [{ ...error, msg: `${name}: ${error.msg}` }, null];

    const from = installedVersion(root, name) ?? row.version;
    if(!isVersion(from) || compareVersions(manifest.version, from) <= 0){
      return [{ code: 409, msg: `${name} is already up to date` }, null];
    }

    const needs = manifest.peerDependencies.kempo ? lowerBound(manifest.peerDependencies.kempo) : null;
    if(needs && compareVersions(needs, kempoVersion) > 0){
      return [{ code: 409, msg: `${name} ${manifest.version} needs Kempo ${needs} or newer: update Kempo first, or at the same time` }, null];
    }

    items.push({ name, row, from, to: manifest.version, major: isBreakingBump(from, manifest.version) });
    targets.push(`${name}@${manifest.version}`);
  }

  return [null, { targets, items }];
};

const countNew = (next = [], old = [], key = item => item.name) => {
  const had = new Set(old.map(key));
  return next.filter(item => !had.has(key(item))).length;
};

/*
  What each updated extension would change, read from the staged copy of its package against what was recorded when it was
  installed: how many permissions, settings, groups, dashboard widgets and scheduled jobs it adds, whether it is breaking (a
  new major version, a new minor one while the major is 0, or the new version says `"breaking": true` in its kempo-config.json), and whether the addresses it
  claims collide with another extension's, which stops the update. Resolves to [error, [entry]].
*/
export const extensionPlan = async ({ dir, items, executor }) => {
  const plan = [];
  for(const item of items){
    let next;
    try {
      ({ kempo: next } = await readKempoConfig(join(dir, 'node_modules', item.name)));
    } catch {
      return [{ code: 500, msg: `${item.name} ${item.to} was not found in the staged copy` }, null];
    }

    const [scopesError] = normalizeScopes(next);
    const [aliasesError] = scopesError ? [null] : normalizeAliases(next.aliases, scopeNames(next));
    const [claimsError] = scopesError || aliasesError || !item.row.enabled
      ? [null]
      : await checkClaims({ names: [item.name], verb: 'update', kempo: { [item.name]: next }, ...(executor ? { executor } : {}) });
    const refusal = scopesError || aliasesError || claimsError;
    if(refusal) return [{ code: 409, msg: `${item.name} ${item.to} cannot be installed: ${refusal.msg}` }, null];

    const old = item.row.kempo || {};
    plan.push({
      name: item.name,
      from: item.from,
      to: item.to,
      major: item.major,
      breaking: item.major || next.breaking === true,
      adds: {
        permissions: countNew(next.permissions, old.permissions),
        settings: countNew(next.settings, old.settings),
        groups: countNew(next.groups, old.groups),
        widgets: countNew(next.widgets, old.widgets, widget => widget.key),
        jobs: countNew(next.jobs, old.jobs)
      }
    });
  }
  return [null, plan];
};
