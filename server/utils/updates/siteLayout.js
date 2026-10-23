import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

/*
  The folders of a site that runs from a Docker volume (KEMPO_SITE_ROOT, normally /site), and the steps that move between
  versions of kempo. It uses nothing but Node's own modules, because the image's startup script runs it before any of the
  site's code can be trusted, and so a copy of it that is older than the site's still understands the state it left.

    app/        the site. Its files are the owner's (public, templates, uploads, .env) and are never moved. Its
                node_modules and package.json are "the code": the only part a version change replaces
    staging/    a new version being installed, with its own node_modules and copy of the manifests, while the site
                keeps running from app/
    releases/   the code the site had before the last switch, kept so it can go back
    state/      what the startup script and the site tell each other (see below)

  A switch is two renames inside one volume, done by the startup script while no site process is running, so the site never
  loads files from two versions at once. Each step can be repeated, so a switch that was cut short finishes at the next start.

  state/switch.json says where a switch is: "requested" (the site asked, nothing moved yet), "switching" (moving),
  "switched" (the new code is in place and has not yet proved itself) and is removed once the site has stayed up for a
  minute. A site that stops while it is "switched" more than MAX_ATTEMPTS times, or says it failed, is put back.
*/
export const MAX_ATTEMPTS = 3;

const MANIFESTS = ['package.json', 'package-lock.json'];

export const paths = siteRoot => ({
  siteRoot,
  app: join(siteRoot, 'app'),
  staging: join(siteRoot, 'staging'),
  releases: join(siteRoot, 'releases'),
  state: join(siteRoot, 'state'),
});

/*
  State files
*/
const readJson = file => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const writeJson = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${file}.tmp`, file);
};

export const readState = (siteRoot, name) => readJson(join(paths(siteRoot).state, `${name}.json`));

export const writeState = (siteRoot, name, data) => writeJson(join(paths(siteRoot).state, `${name}.json`), data);

export const clearState = (siteRoot, name) => rmSync(join(paths(siteRoot).state, `${name}.json`), { force: true });

const versionIn = dir => readJson(join(dir, 'node_modules', 'kempo', 'package.json'))?.version ?? null;

const releaseId = version => `${Date.now()}-${version}`;

const copyManifests = (from, to) => {
  for(const name of MANIFESTS){
    if(existsSync(join(from, name))) cpSync(join(from, name), join(to, name));
  }
};

/*
  The first start: the image holds the site as it was built (its files and its node_modules) and the volume is empty,
  so the volume is filled from it. After that the volume is the site and the image is only the runtime.
*/
export const seedSite = ({ siteRoot, seed }) => {
  const { app } = paths(siteRoot);
  if(existsSync(join(app, 'package.json'))) return false;
  mkdirSync(app, { recursive: true });
  cpSync(seed, app, { recursive: true, verbatimSymlinks: true });
  const version = versionIn(app);
  writeState(siteRoot, 'current', { id: releaseId(version ?? 'seed'), version, previous: null });
  return true;
};

export const getCurrent = siteRoot => readState(siteRoot, 'current') ?? { id: null, version: versionIn(paths(siteRoot).app), previous: null };

/*
  Staging a new version: a copy of the code the site has now, which the caller then installs into. The running site is
  not touched. Only one is kept: staging again replaces the one before.
*/
export const stage = ({ siteRoot, version }) => {
  const { app, staging } = paths(siteRoot);
  rmSync(staging, { recursive: true, force: true });
  const id = releaseId(version);
  const dir = join(staging, id);
  mkdirSync(dir, { recursive: true });
  copyManifests(app, dir);
  cpSync(join(app, 'node_modules'), join(dir, 'node_modules'), { recursive: true, verbatimSymlinks: true });
  return { id, dir };
};

/*
  Asking for a switch. `source` is a folder holding node_modules and the manifests: a staged version, or an earlier
  release to go back to. The startup script does it at the next start.
*/
export const requestSwitch = ({ siteRoot, id, version, source, kind = 'update', ...details }) => {
  const current = getCurrent(siteRoot);
  writeState(siteRoot, 'switch', { status: 'requested', kind, id, version, source, from: { id: current.id, version: current.version }, attempts: 0, requestedAt: new Date().toISOString(), ...details });
};

const swapIn = ({ siteRoot, sw }) => {
  const { app, releases } = paths(siteRoot);
  const old = join(releases, sw.from.id ?? `${Date.now()}-unknown`);
  const oldModules = join(app, 'node_modules');

  if(existsSync(oldModules) && !existsSync(join(old, 'node_modules'))){
    mkdirSync(old, { recursive: true });
    renameSync(oldModules, join(old, 'node_modules'));
    copyManifests(app, old);
  }
  if(existsSync(join(sw.source, 'node_modules'))){
    renameSync(join(sw.source, 'node_modules'), oldModules);
    copyManifests(sw.source, app);
  }
  rmSync(sw.source, { recursive: true, force: true });
  rmSync(paths(siteRoot).staging, { recursive: true, force: true });
  writeState(siteRoot, 'current', { id: sw.id, version: sw.version, previous: { id: sw.from.id, version: sw.from.version } });
};

/* Carries out a requested (or half-done) switch. Returns the switch, or null when there was nothing to do. */
export const performSwitch = siteRoot => {
  const sw = readState(siteRoot, 'switch');
  if(!sw || !['requested', 'switching'].includes(sw.status)) return null;
  writeState(siteRoot, 'switch', { ...sw, status: 'switching' });
  swapIn({ siteRoot, sw });
  const done = { ...sw, status: 'switched', attempts: 0 };
  writeState(siteRoot, 'switch', done);
  return done;
};

/*
  Files the update changed outside the code (starter files), saved before they were overwritten, put back: those that
  existed are restored and those the update created are removed.
*/
export const restoreFiles = ({ siteRoot, backup }) => {
  if(!backup?.dir) return;
  const { app } = paths(siteRoot);
  for(const { path, existed } of backup.files ?? []){
    if(existed) cpSync(join(backup.dir, path), join(app, path), { force: true });
    else rmSync(join(app, path), { force: true });
  }
};

/*
  Back to the release before this one. Used by the startup script when a new version keeps failing, and for going back by
  hand. Records why in state/last.json.
*/
export const rollBack = ({ siteRoot, reason }) => {
  const sw = readState(siteRoot, 'switch');
  const current = getCurrent(siteRoot);
  const previous = current.previous;
  const source = previous?.id ? join(paths(siteRoot).releases, previous.id) : null;
  if(!source || !existsSync(join(source, 'node_modules'))) return { ok: false, reason: 'There is no earlier version to go back to' };

  swapIn({ siteRoot, sw: { id: previous.id, version: previous.version, source, from: { id: current.id, version: current.version } } });
  restoreFiles({ siteRoot, backup: sw?.filesBackup });
  writeState(siteRoot, 'last', { ok: false, from: current.version, to: previous.version, reason, at: new Date().toISOString(), dbBackup: sw?.dbBackup ?? null });
  clearState(siteRoot, 'switch');
  return { ok: true, from: current.version, to: previous.version, dbBackup: sw?.dbBackup ?? null };
};

/* True when a switch has not proved itself and the site has failed to stay up. Going back by hand is never undone by itself. */
export const shouldRollBack = sw => sw?.status === 'switched' && sw.kind !== 'rollback' && (Boolean(sw.failed) || sw.attempts > MAX_ATTEMPTS);

export const countAttempt = siteRoot => {
  const sw = readState(siteRoot, 'switch');
  if(sw?.status !== 'switched') return sw;
  const next = { ...sw, attempts: sw.attempts + 1 };
  writeState(siteRoot, 'switch', next);
  return next;
};

/* The site says its new code cannot work (a data migration failed). It is put back at the next start. */
export const flagFailed = ({ siteRoot, reason }) => {
  const sw = readState(siteRoot, 'switch');
  if(sw?.status === 'switched') writeState(siteRoot, 'switch', { ...sw, failed: true, failure: reason });
};

/* The new code has stayed up: the switch is final, and every release but the one before this is deleted. */
export const markHealthy = siteRoot => {
  const sw = readState(siteRoot, 'switch');
  if(sw?.status !== 'switched') return false;
  const { releases } = paths(siteRoot);
  const current = getCurrent(siteRoot);
  writeState(siteRoot, 'last', { ok: true, from: sw.from.version, to: sw.version, kind: sw.kind, breaking: Boolean(sw.breaking), packages: sw.packages ?? [], dbBackup: sw.dbBackup ?? null, filesBackup: sw.filesBackup ?? null, at: new Date().toISOString() });
  clearState(siteRoot, 'switch');
  if(existsSync(releases)){
    for(const name of readdirSync(releases)){
      if(name !== current.previous?.id) rmSync(join(releases, name), { recursive: true, force: true });
    }
  }
  return true;
};
