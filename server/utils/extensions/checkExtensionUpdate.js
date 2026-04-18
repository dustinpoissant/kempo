import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const toRawUrl = (gitUrl, file = 'package.json') => {
  const match = gitUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if(!match) return null;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/main/${file}`;
};

const semverGt = (a, b) => {
  const parse = v => (v || '0.0.0').replace(/^v/, '').split('.').map(Number);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if(aMaj !== bMaj) return aMaj > bMaj;
  if(aMin !== bMin) return aMin > bMin;
  return aPatch > bPatch;
};

export default async ({ name }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
  }

  let record;
  try {
    [record] = await db.select().from(extension).where(eq(extension.name, name)).limit(1);
    if(!record){
      return [{ code: 404, msg: 'Extension not found' }, null];
    }
  } catch(error){
    return [{ code: 500, msg: 'Failed to find extension' }, null];
  }

  const gitUrl = record.kempo?.git;
  if(!gitUrl){
    return [null, { hasUpdate: false, reason: 'No git URL configured' }];
  }

  const rawUrl = toRawUrl(gitUrl);
  if(!rawUrl){
    return [null, { hasUpdate: false, reason: 'Unsupported git URL format' }];
  }

  let remotePkg;
  try {
    const res = await fetch(rawUrl);
    if(!res.ok) return [null, { hasUpdate: false, reason: 'Failed to fetch remote package.json' }];
    remotePkg = await res.json();
  } catch(error){
    return [{ code: 502, msg: 'Failed to reach remote repository' }, null];
  }

  const hasUpdate = semverGt(remotePkg.version, record.version);
  return [null, { hasUpdate, currentVersion: record.version, latestVersion: remotePkg.version }];
};
