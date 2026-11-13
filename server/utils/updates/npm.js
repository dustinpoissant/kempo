import { execFile } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { PACKAGE, compareVersions, lowerBound } from './helpers.js';
import { NAME_PATTERN } from '../extensions/marketplaceClient.js';

const execute = promisify(execFile);

/*
  A version that was published a moment ago can answer 404 until the registry serves it everywhere, so a 404 is tried
  again over about a minute before the update is given up.
*/
const RETRY_DELAYS_MS = [15000, 30000, 60000];

/* `npm install` of already validated targets (plain names and x.y.z or "latest") in `cwd`. */
export const runNpm = async (args, cwd) => {
  for(let attempt = 0; ; attempt++){
    try {
      return await execute('npm', ['install', ...args, '--no-audit', '--no-fund'], {
        cwd,
        shell: process.platform === 'win32',
        timeout: 10 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024
      });
    } catch(error) {
      const notYet = /\b404\b/.test(String(error.stderr || error.message || ''));
      if(!notYet || attempt >= RETRY_DELAYS_MS.length) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
};

export const installedVersion = (dir, name) => {
  try {
    return JSON.parse(readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
};

/*
  What to install for a manifest of kempo: kempo itself, and any peer (kempo-server, kempo-ui, kempo-css) that is installed
  in `dir` at a version below what the new kempo asks for at least. A peer that already meets it is left alone.
*/
export const targetsFor = ({ manifest, dir }) => {
  const targets = [`${PACKAGE}@${manifest.version}`];
  for(const [name, range] of Object.entries(manifest.peerDependencies)){
    const bound = lowerBound(range);
    const installed = installedVersion(dir, name);
    if(NAME_PATTERN.test(name) && bound && installed && compareVersions(installed, bound) < 0) targets.push(`${name}@latest`);
  }
  return targets;
};

/* The last lines of what npm said when it failed. */
export const npmFailure = error => String(error.stderr || error.message || '').trim().split('\n').filter(Boolean).slice(-3).join(' ');
