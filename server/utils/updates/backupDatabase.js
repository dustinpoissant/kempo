import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

/*
  A copy of the whole database in `file`, as gzipped plain SQL that restores itself (it drops what it replaces), taken with
  pg_dump. It is what an update that changes data is put back from, so without pg_dump (the Docker image has it) such an
  update is refused rather than made without a way back. `spawner` is for tests.
*/
export default async ({ file, url = process.env.DATABASE_URL, spawner = spawn } = {}) => {
  if(!file) return [{ code: 400, msg: 'A file to write the backup to is required' }, null];
  if(!url) return [{ code: 500, msg: 'DATABASE_URL is not set, so the database cannot be backed up' }, null];

  mkdirSync(dirname(file), { recursive: true });
  const dump = spawner('pg_dump', ['--clean', '--if-exists', '--no-owner', '--no-privileges', url], { stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  dump.stderr?.on('data', chunk => { errors += chunk; });
  const ended = new Promise(resolve => {
    dump.on('error', error => resolve(error.code === 'ENOENT' ? 'missing' : error.message));
    dump.on('exit', code => resolve(code === 0 ? null : `pg_dump ended with ${code}: ${errors.trim().split('\n').slice(-2).join(' ')}`));
  });

  try {
    await pipeline(dump.stdout, createGzip(), createWriteStream(file));
  } catch(error) {
    return [{ code: 500, msg: `The database backup could not be written: ${error.message}` }, null];
  }

  const problem = await ended;
  if(problem === 'missing') return [{ code: 501, msg: 'pg_dump is not installed here, so the data cannot be backed up and this update will not be made without one' }, null];
  if(problem) return [{ code: 500, msg: `The database could not be backed up: ${problem}` }, null];
  return [null, { file }];
};
