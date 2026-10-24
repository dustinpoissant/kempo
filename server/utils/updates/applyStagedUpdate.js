import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { and, eq, like } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification } from '../../db/schema.js';
import { RUNNING_VERSION } from './runtime.js';
import backupDatabase from './backupDatabase.js';
import { restartMode, scheduleRestart } from './restart.js';
import { basisOf, clearState, paths, readState, requestSwitch } from './siteLayout.js';
import { applyStarterFiles } from './starterFiles.js';
import { PACKAGE } from './helpers.js';
import triggerHook from '../hooks/triggerHook.js';
import markHandled from '../notifications/markHandled.js';

let switching = false;

/* The notifications about extension updates are done with once the owner has acted on them. */
const resolveExtensionNotices = async () => {
  const rows = await db.select({ id: notification.id }).from(notification).where(and(eq(notification.owner, PACKAGE), like(notification.dedupeKey, 'extension-updates:%')));
  for(const { id } of rows) await markHandled({ notificationId: id });
};

/*
  Switches a site that runs from a Docker volume to what prepareUpdate staged (a new kempo, new extensions, or both): replaces
  the starter files the owner never touched (and, when the owner confirms, the ones a security fix must replace, keeping a
  copy of each), backs the database up first if anything in the update changes data, then asks for the switch and restarts.
  The startup script moves the code into place while nothing is running, the site is only unavailable for the restart, and
  at that start each extension is brought up to date (reconcileExtensions) before the site serves anything.

  `confirm` is { forced: true, breaking: true }: the owner has accepted that edited files will be replaced, and that an
  update which changes data (a data migration in kempo, or a new major version of an extension) can only be undone from a
  backup. Without them, an update that needs them answers 409 with `details` saying which, and does nothing.

  Resolves to [error, { from, to, restart, breaking }].
*/
export default async ({ confirm = {}, siteRoot = process.env.KEMPO_SITE_ROOT, cwd = process.cwd(), restart = scheduleRestart, backup = backupDatabase } = {}) => {
  if(!siteRoot){
    return [{ code: 409, msg: 'This site is not set up to switch to a prepared update' }, null];
  }
  if(switching){
    return [{ code: 409, msg: 'A switch is already under way' }, null];
  }

  const staged = readState(siteRoot, 'staged');
  if(!staged || !existsSync(join(staged.dir, 'node_modules'))){
    return [{ code: 409, msg: 'No update is ready: prepare one first' }, null];
  }
  if(readState(siteRoot, 'switch')){
    return [{ code: 409, msg: 'The last switch is still being checked, which takes about a minute after the restart. Try again shortly.' }, null];
  }
  if(staged.basis && staged.basis !== basisOf(siteRoot)){
    rmSync(paths(siteRoot).staging, { recursive: true, force: true });
    clearState(siteRoot, 'staged');
    return [{ code: 409, msg: 'The site changed after this update was downloaded (another update, or an extension was installed), so switching to it would undo that. It has been thrown away: get the update ready again.' }, null];
  }

  const { plan } = staged;
  if(plan.files.forced.length && !confirm.forced){
    return [{ code: 409, msg: 'This update must replace files you have edited', details: { confirm: 'forced', files: plan.files.forced } }, null];
  }
  if(plan.breaking && !confirm.breaking){
    return [{ code: 409, msg: 'This update changes your data and can only be undone from a backup', details: { confirm: 'breaking', upgrades: plan.upgrades.filter(upgrade => upgrade.breaking), extensions: plan.extensions.filter(extension => extension.breaking).map(extension => extension.name) } }, null];
  }

  switching = true;
  try {
    let dbBackup = null;
    if(plan.breaking){
      dbBackup = join(paths(siteRoot).state, 'backups', `${staged.id}.sql.gz`);
      const [backupError] = await backup({ file: dbBackup });
      if(backupError) return [backupError, null];
    }

    const filesBackup = staged.kempoUpdate
      ? applyStarterFiles({
        cwd,
        newRoot: join(staged.dir, 'node_modules', 'kempo'),
        version: staged.version,
        plan: plan.files,
        includeForced: Boolean(confirm.forced),
        backupDir: join(paths(siteRoot).state, 'backups', `${staged.id}-files`)
      })
      : null;

    requestSwitch({ siteRoot, id: staged.id, version: staged.version, source: staged.dir, kind: 'update', breaking: plan.breaking, packages: staged.packages, dbBackup, filesBackup });
    clearState(siteRoot, 'staged');

    if(staged.kempoUpdate){
      await markHandled({ owner: PACKAGE, dedupeKey: `update:${staged.version}` });
      await triggerHook('kempo:updated', { oldVersion: RUNNING_VERSION, newVersion: staged.version, packages: staged.packages });
    }
    if(plan.extensions.length) await resolveExtensionNotices();
    restart();
    return [null, { from: RUNNING_VERSION, to: staged.version, restart: restartMode(), breaking: plan.breaking }];
  } catch(error) {
    return [{ code: 500, msg: `The switch could not be requested: ${error.message}` }, null];
  } finally {
    switching = false;
  }
};
