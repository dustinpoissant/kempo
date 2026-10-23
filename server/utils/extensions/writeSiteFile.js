import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, normalize, sep } from 'path';

/*
  For an extension that has to put a file into the site (a generated template, a starter page): writes it the way kempo's own
  starter files are handled, so an update of the extension never overwrites what the owner changed.

    not there, never written by this extension     written
    not there, but this extension wrote it before  the owner deleted it, so it stays deleted
    identical to what is being written             nothing to do
    still exactly what this extension last wrote   never edited, so replaced
    anything else                                  edited by the owner (or anyone), so kept

  The extension's fingerprints are in .kempo/shipped/<owner>.json. `path` is relative to the site and must be inside public/
  or templates/. Most extensions need none of this, because their own public/ is served from the package; this is for the
  few that generate something into the site. Resolves to [error, { status }] where status is "written", "current", "kept"
  or "deleted".
*/
const hashOf = content => createHash('sha256').update(content).digest('hex');

export default ({ owner, path, content, cwd = process.cwd() } = {}) => {
  if(typeof owner !== 'string' || !/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(owner)){
    return [{ code: 400, msg: 'owner must be the extension name' }, null];
  }
  const relative = typeof path === 'string' ? normalize(path).split(sep).join('/') : '';
  if(!relative || relative.startsWith('..') || relative.startsWith('/') || !/^(public|templates)\//.test(relative)){
    return [{ code: 400, msg: 'path must be a file inside public/ or templates/' }, null];
  }
  if(typeof content !== 'string' && !Buffer.isBuffer(content)){
    return [{ code: 400, msg: 'content must be text or a buffer' }, null];
  }

  const recordFile = join(cwd, '.kempo', 'shipped', `${owner.replace('/', '__')}.json`);
  let files = {};
  try {
    files = JSON.parse(readFileSync(recordFile, 'utf8')).files ?? {};
  } catch {
    files = {};
  }
  const save = () => {
    mkdirSync(dirname(recordFile), { recursive: true });
    writeFileSync(recordFile, JSON.stringify({ files }, null, 2));
  };

  const target = join(cwd, relative);
  const wanted = hashOf(content);

  if(!existsSync(target)){
    if(files[relative]) return [null, { status: 'deleted' }];
  } else {
    const here = hashOf(readFileSync(target));
    if(here === wanted){
      files[relative] = wanted;
      save();
      return [null, { status: 'current' }];
    }
    if(files[relative] !== here) return [null, { status: 'kept' }];
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  files[relative] = wanted;
  save();
  return [null, { status: 'written' }];
};
