import { existsSync } from 'fs';
import { join } from 'path';
import { RUNNING_VERSION } from './runtime.js';
import { restartMode, scheduleRestart } from './restart.js';
import { getCurrent, paths, readState, requestSwitch } from './siteLayout.js';

let going = false;

/*
  Puts a site that runs from a Docker volume back on the version it had before the last update: the code, and the
  starter files the update replaced. If that update changed data, going back also restores the database from the backup
  taken before it, which loses whatever was entered since, so that needs `confirm.data`. Otherwise (the usual case: an
  update only added to the database) the earlier version runs on the database as it is and nothing is lost.

  Resolves to [error, { from, to, restart, restoresData }].
*/
export default async ({ confirm = {}, siteRoot = process.env.KEMPO_SITE_ROOT, restart = scheduleRestart } = {}) => {
  if(!siteRoot){
    return [{ code: 409, msg: 'This site is not set up to go back to an earlier version' }, null];
  }
  if(going){
    return [{ code: 409, msg: 'A switch is already under way' }, null];
  }
  if(readState(siteRoot, 'switch')){
    return [{ code: 409, msg: 'The last switch has not finished proving itself yet' }, null];
  }

  const { previous, version } = getCurrent(siteRoot);
  const source = previous?.id ? join(paths(siteRoot).releases, previous.id) : null;
  if(!source || !existsSync(join(source, 'node_modules'))){
    return [{ code: 409, msg: 'There is no earlier version to go back to' }, null];
  }

  const last = readState(siteRoot, 'last');
  const restoresData = Boolean(last?.ok && last.breaking && last.to === version && last.dbBackup && existsSync(last.dbBackup));
  if(restoresData && !confirm.data){
    return [{ code: 409, msg: 'Going back restores the database from before the update and loses what was entered since', details: { confirm: 'data' } }, null];
  }

  going = true;
  try {
    requestSwitch({
      siteRoot,
      id: previous.id,
      version: previous.version,
      source,
      kind: 'rollback',
      filesBackup: last?.ok && last.to === version ? last.filesBackup : null,
      dbBackup: restoresData ? last.dbBackup : null
    });
    restart();
    return [null, { from: RUNNING_VERSION, to: previous.version, restart: restartMode(), restoresData }];
  } finally {
    going = false;
  }
};
