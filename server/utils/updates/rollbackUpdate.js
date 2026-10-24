import { RUNNING_VERSION } from './runtime.js';
import goBackPlan from './goBackPlan.js';
import { restartMode, scheduleRestart } from './restart.js';
import { requestSwitch } from './siteLayout.js';

let going = false;

/*
  Puts a site that runs from a Docker volume back on the version it had before the last update: the code, and the
  starter files the update replaced. If that update changed data, going back also restores the database from the backup
  taken before it, which loses whatever was entered since, so that needs `confirm.data`. Otherwise (the usual case: an
  update only added to the database) the earlier version runs on the database as it is and nothing is lost. What it
  would do, and whether it is allowed now, is goBackPlan, the same answer the Updates screen shows.

  Resolves to [error, { from, to, restart, restoresData }].
*/
export default async ({ confirm = {}, siteRoot = process.env.KEMPO_SITE_ROOT, restart = scheduleRestart } = {}) => {
  if(!siteRoot){
    return [{ code: 409, msg: 'This site is not set up to go back to an earlier version' }, null];
  }
  if(going){
    return [{ code: 409, msg: 'A switch is already under way' }, null];
  }

  const plan = goBackPlan(siteRoot);
  if(!plan.available){
    return [{ code: 409, msg: plan.reason }, null];
  }
  if(plan.restoresData && !confirm.data){
    return [{ code: 409, msg: 'Going back restores the database from before the update and loses what was entered since', details: { confirm: 'data' } }, null];
  }

  going = true;
  try {
    requestSwitch({
      siteRoot,
      id: plan.previous.id,
      version: plan.previous.version,
      source: plan.source,
      kind: 'rollback',
      filesBackup: plan.last?.ok && plan.last.to === plan.version ? plan.last.filesBackup : null,
      dbBackup: plan.restoresData ? plan.last.dbBackup : null
    });
    restart();
    return [null, { from: RUNNING_VERSION, to: plan.previous.version, restart: restartMode(), restoresData: plan.restoresData }];
  } finally {
    going = false;
  }
};
