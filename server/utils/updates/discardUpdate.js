import { rmSync } from 'fs';
import { clearState, paths, readState } from './siteLayout.js';

/* Throws away a staged update that was not switched to, which frees its disk space. */
export default ({ siteRoot = process.env.KEMPO_SITE_ROOT } = {}) => {
  if(!siteRoot) return [{ code: 409, msg: 'This site has no staged updates' }, null];
  if(readState(siteRoot, 'switch')) return [{ code: 409, msg: 'A switch is under way' }, null];
  rmSync(paths(siteRoot).staging, { recursive: true, force: true });
  clearState(siteRoot, 'staged');
  return [null, { discarded: true }];
};
