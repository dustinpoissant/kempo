import { createHash } from 'crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join, relative, sep } from 'path';

/*
  The starter files: what `npx kempo init` copies from the kempo package into a site (app-public/ into public/, and
  app-templates/ into templates/). They start as kempo's and become the owner's the moment anyone edits one.

  Kempo remembers the fingerprint (SHA-256) of each starter file it put in the site, in .kempo/shipped.json. An update then
  treats a file in the site like this:

    identical to the new version's       nothing to do
    still what kempo put there           never edited: replaced by the new version
    anything else                        edited, by anyone (the admin, FTP, a shell): kept, and offered as "newer" only
    missing, but kempo shipped it before the owner deleted it: it stays deleted
    missing and new in this version      added

  A site made before this record existed has none, so a file is judged against what the version that is running ships.
  A version can name files it must replace even when they were edited (a security fix) in its package.json:
  { "kempo": { "forceUpdate": ["public/login/", "public/init.js"] } }. Those wait for the owner's confirmation, and the
  file as it was is saved first.
*/
export const SOURCES = [['app-public', 'public'], ['app-templates', 'templates']];

const RECORD = ['.kempo', 'shipped.json'];

const hashOf = file => createHash('sha256').update(readFileSync(file)).digest('hex');

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));

/* [{ path, source, hash }] for every starter file a kempo package ships, `path` being where it goes in the site. */
export const listShipped = packageRoot => SOURCES.flatMap(([from, to]) => {
  const base = join(packageRoot, from);
  if(!existsSync(base)) return [];
  return walk(base).map(file => ({ path: `${to}/${relative(base, file).split(sep).join('/')}`, source: file, hash: hashOf(file) }));
});

export const readRecord = cwd => {
  try {
    return JSON.parse(readFileSync(join(cwd, ...RECORD), 'utf8'));
  } catch {
    return { version: null, files: {} };
  }
};

const writeRecord = (cwd, record) => {
  mkdirSync(join(cwd, '.kempo'), { recursive: true });
  writeFileSync(join(cwd, ...RECORD), JSON.stringify(record, null, 2));
};

/* The files a version must replace, from its package.json. */
export const forcedFiles = packageRoot => {
  try {
    return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).kempo?.forceUpdate ?? [];
  } catch {
    return [];
  }
};

/* For `npx kempo init`: remembers what was copied. */
export const recordShipped = ({ cwd, packageRoot, version }) => {
  const files = {};
  for(const file of listShipped(packageRoot)){
    if(existsSync(join(cwd, file.path)) && hashOf(join(cwd, file.path)) === file.hash) files[file.path] = file.hash;
  }
  writeRecord(cwd, { version, files });
};

/* What an update would do to the site's starter files. Changes nothing. */
export const planStarterFiles = ({ cwd, oldRoot, newRoot, forced = forcedFiles(newRoot) }) => {
  const recorded = readRecord(cwd).files;
  const before = new Map(listShipped(oldRoot).map(file => [file.path, file.hash]));
  const plan = { add: [], update: [], current: [], edited: [], deleted: [], forced: [] };

  for(const file of listShipped(newRoot)){
    const target = join(cwd, file.path);
    if(!existsSync(target)){
      (recorded[file.path] || before.has(file.path) ? plan.deleted : plan.add).push(file.path);
    } else if(before.get(file.path) === file.hash || hashOf(target) === file.hash){
      plan.current.push(file.path);
    } else {
      const shipped = recorded[file.path] ?? before.get(file.path);
      if(shipped && hashOf(target) === shipped) plan.update.push(file.path);
      else if(forced.some(entry => entry === file.path || (entry.endsWith('/') && file.path.startsWith(entry)))) plan.forced.push(file.path);
      else plan.edited.push(file.path);
    }
  }
  return plan;
};

/*
  Does it. Every file it replaces is copied to `backupDir` first. Resolves to { dir, files: [{ path, existed }] }, which is
  what putting them back needs (restoreFiles in siteLayout.js).
*/
export const applyStarterFiles = ({ cwd, newRoot, version, plan, includeForced = false, backupDir }) => {
  const shipped = new Map(listShipped(newRoot).map(file => [file.path, file]));
  const changed = [...plan.add, ...plan.update, ...(includeForced ? plan.forced : [])];
  const files = [];

  for(const path of changed){
    const target = join(cwd, path);
    const existed = existsSync(target);
    if(existed){
      mkdirSync(dirname(join(backupDir, path)), { recursive: true });
      cpSync(target, join(backupDir, path));
    }
    mkdirSync(dirname(target), { recursive: true });
    cpSync(shipped.get(path).source, target);
    files.push({ path, existed });
  }

  const record = readRecord(cwd);
  for(const path of [...changed, ...plan.current]){
    if(existsSync(join(cwd, path)) && hashOf(join(cwd, path)) === shipped.get(path).hash) record.files[path] = shipped.get(path).hash;
  }
  writeRecord(cwd, { version, files: record.files });
  return { dir: backupDir, files };
};
