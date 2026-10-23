import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { compareVersions, isVersion } from '../updates/helpers.js';
import fetchManifest from '../updates/fetchManifest.js';

/* Whether npm has a newer version of one installed extension than the one recorded for it. */
export default async ({ name, fetcher }) => {
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

  const [error, manifest] = await fetchManifest({ name, fetcher });
  if(error?.code === 404) return [null, { hasUpdate: false, reason: 'This extension is not on npm' }];
  if(error) return [error, null];

  const hasUpdate = isVersion(record.version) && compareVersions(manifest.version, record.version) > 0;
  return [null, { hasUpdate, currentVersion: record.version, latestVersion: manifest.version }];
};
