import { readFileSync } from 'fs';
import { join, sep } from 'path';
import { PACKAGE } from './helpers.js';
import { PACKAGE_ROOT } from './runtime.js';

/*
  Whether this site can update kempo by installing a new version of it. A checkout that is linked or run
  from source (this repository, or a site using `npm run link:local`) is refused: `npm install` would
  replace the link with the registry copy and throw the local work away.
*/
export default ({ cwd = process.cwd(), packageRoot = PACKAGE_ROOT } = {}) => {
  if(!packageRoot.startsWith(join(cwd, 'node_modules') + sep)){
    return { canUpdate: false, reason: 'Kempo is linked from a local checkout, not installed from npm.' };
  }

  try {
    const spec = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).dependencies?.[PACKAGE];
    if(!spec) return { canUpdate: false, reason: "Kempo is not a dependency in this site's package.json." };
    if(/^(file|link|git|github|https?):/.test(spec)) return { canUpdate: false, reason: `This site's package.json points kempo at "${spec}", not at an npm version.` };
  } catch {
    return { canUpdate: false, reason: "This site's package.json could not be read." };
  }

  return { canUpdate: true, reason: null };
};
