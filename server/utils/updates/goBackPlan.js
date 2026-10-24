import { existsSync } from 'fs';
import { join } from 'path';
import { getCurrent, paths, readState } from './siteLayout.js';

/*
  What "Go back" would do right now, worked out in one place so that what the Updates screen says and what the server does
  cannot differ. It is not offered while a switch is still proving itself (the site is a minute old and its record of what
  it came from is not final), or when there is no earlier version, or straight after a rollback, whether by hand or because the new version failed (the earlier version is then
  the one that was just left, and "going back" would be a confusing way to say "update again"). It restores the database
  only when the update being undone changed data and its backup is still there.
*/
export default siteRoot => {
  const { previous, version } = getCurrent(siteRoot);
  const source = previous?.id ? join(paths(siteRoot).releases, previous.id) : null;
  const last = readState(siteRoot, 'last');
  const plan = { available: false, reason: null, restoresData: false, previous, version, source, last };

  if(readState(siteRoot, 'switch')){
    plan.reason = 'The last switch is still being checked, which takes about a minute after the restart. Try again shortly.';
    return plan;
  }
  if(!source || !existsSync(join(source, 'node_modules'))){
    plan.reason = 'There is no earlier version to go back to';
    return plan;
  }
  if(last?.kind === 'rollback' || last?.ok === false){
    plan.reason = 'The site has just gone back, so there is nothing newer to go back from. To move forward again, update it.';
    return plan;
  }

  plan.available = true;
  plan.restoresData = Boolean(last?.ok && last.breaking && last.to === version && last.dbBackup && existsSync(last.dbBackup));
  return plan;
};
