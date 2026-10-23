import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import readKempoConfig from './readKempoConfig.js';
import upgradeExtension from './upgradeExtension.js';
import { normalizeAliases } from './aliases.js';
import { normalizeScopes, scopeNames } from './scopes.js';
import checkClaims from './checkClaims.js';

const requireFromProject = createRequire(join(process.cwd(), 'package.json'));

/*
  Installs a newer version of one extension in place, and brings the database in step with it straight away, without a
  restart (see upgradeExtension). For a site that runs from a Docker volume updates go through the Updates screen instead,
  which stages them, shows what they change and can go back; this refuses there so it cannot bypass that.
*/
export default async ({ name, version = 'latest' }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
  }
  if(process.env.KEMPO_SITE_ROOT){
    return [{ code: 409, msg: 'This site updates extensions from the Updates screen' }, null];
  }

  let oldRecord;
  try {
    [oldRecord] = await db.select().from(extension).where(eq(extension.name, name)).limit(1);
    if(!oldRecord){
      return [{ code: 404, msg: 'Extension not found' }, null];
    }
  } catch(error){
    return [{ code: 500, msg: 'Failed to find extension' }, null];
  }

  const oldVersion = oldRecord.version;

  try {
    execSync(`npm install ${name}@${version}`, { cwd: process.cwd(), stdio: 'pipe' });
  } catch(error){
    return [{ code: 500, msg: `Failed to update package: ${error.message}` }, null];
  }

  let extRoot, newKempo;
  try {
    extRoot = dirname(requireFromProject.resolve(`${name}/package.json`));
    ({ kempo: newKempo } = await readKempoConfig(extRoot));
  } catch {
    return [{ code: 404, msg: `Updated package "${name}" not found` }, null];
  }

  /*
    The new version may claim addresses the old one did not. If it is on and another extension has one
    of them, put the old version back before anything else changes: leaving the new one would break
    one of the two, silently.
  */
  const [scopesError] = normalizeScopes(newKempo);
  const [aliasesError] = scopesError ? [null] : normalizeAliases(newKempo.aliases, scopeNames(newKempo));
  const [claimsError] = scopesError || aliasesError || !oldRecord.enabled
    ? [null]
    : await checkClaims({ names: [name], verb: 'update', kempo: { [name]: newKempo } });
  const refusal = scopesError || aliasesError || claimsError;
  if(refusal){
    let msg = refusal.msg;
    try {
      if(oldVersion) execSync(`npm install ${name}@${oldVersion}`, { cwd: process.cwd(), stdio: 'pipe' });
    } catch {
      msg += ` The previous version could not be put back automatically: run npm install ${name}@${oldVersion}.`;
    }
    return [{ ...refusal, msg }, null];
  }

  return upgradeExtension({ name, record: oldRecord, extRoot });
};
