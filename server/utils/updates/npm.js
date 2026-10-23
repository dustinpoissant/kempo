import { execFile } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { PACKAGE, compareVersions, lowerBound } from './helpers.js';
import { NAME_PATTERN } from '../extensions/marketplaceClient.js';

const execute = promisify(execFile);

/* `npm install` of already validated targets (plain names and x.y.z or "latest") in `cwd`. */
export const runNpm = (args, cwd) => execute('npm', ['install', ...args, '--no-audit', '--no-fund'], {
  cwd,
  shell: process.platform === 'win32',
  timeout: 10 * 60 * 1000,
  maxBuffer: 10 * 1024 * 1024
});

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
