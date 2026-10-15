import { execFile } from 'child_process';
import { promisify } from 'util';
import { NAME_PATTERN } from './catalogClient.js';

const run = promisify(execFile);

/*
  Downloads an extension's package into this site's node_modules with `npm install`, which also adds it
  to the site's package.json. Only an exact package name and a plain version or tag are accepted, which
  is what makes passing them to a shell on Windows (where npm is a .cmd) safe.

  Note for container deployments: this changes the running container's files. A redeploy that rebuilds
  the image from the repository's package.json does not include it, so add the package there too.
*/
export default async ({ name, version = 'latest' }) => {
  if(typeof name !== 'string' || !NAME_PATTERN.test(name)){
    return [{ code: 400, msg: 'Extension name is not a valid package name' }, null];
  }
  if(typeof version !== 'string' || !/^[A-Za-z0-9._-]+$/.test(version)){
    return [{ code: 400, msg: 'Extension version is not valid' }, null];
  }

  try {
    await run('npm', ['install', `${name}@${version}`, '--no-audit', '--no-fund'], {
      cwd: process.cwd(),
      shell: process.platform === 'win32',
      timeout: 5 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch(error) {
    const detail = String(error.stderr || error.message || '').trim().split('\n').filter(Boolean).slice(-3).join(' ');
    return [{ code: 500, msg: `Failed to download "${name}": ${detail}` }, null];
  }

  return [null, { name, version }];
};
