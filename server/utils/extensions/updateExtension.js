import db from '../../db/index.js';
import { extension, hook, permission, group, groupPermission } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import triggerHook, { clearHandlerCache } from '../hooks/triggerHook.js';
import createHook from '../hooks/createHook.js';
import registerDashboardWidget from '../dashboard/registerDashboardWidget.js';
import unregisterDashboardWidget from '../dashboard/unregisterDashboardWidget.js';
import registerJobs from '../scheduler/registerJobs.js';
import setSetting from '../settings/setSetting.js';
import declaredValue from '../settings/declaredValue.js';
import createTablesFromSchema from './createTablesFromSchema.js';
import readKempoConfig from './readKempoConfig.js';
import { normalizeAliases } from './aliases.js';
import { normalizeScopes, scopeNames } from './scopes.js';
import checkClaims from './checkClaims.js';

const requireFromProject = createRequire(join(process.cwd(), 'package.json'));

export default async ({ name, version = 'latest' }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
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

  const oldKempo = oldRecord.kempo || {};
  const oldVersion = oldRecord.version;

  /*
    Install updated package
  */
  try {
    execSync(`npm install ${name}@${version}`, { cwd: process.cwd(), stdio: 'pipe' });
  } catch(error){
    return [{ code: 500, msg: `Failed to update package: ${error.message}` }, null];
  }

  /*
    What the new version declares comes from its kempo-config.json (package.json's own `kempo` field is
    only the fallback for an older extension). Reading package.json alone meant that no extension's new
    permissions, settings, groups, hooks or widgets ever reached the database through this update.
  */
  let extRoot, pkg, newKempo;
  try {
    extRoot = dirname(requireFromProject.resolve(`${name}/package.json`));
    ({ pkg, kempo: newKempo } = await readKempoConfig(extRoot));
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

  /*
    Create any new tables from schema
  */
  if(newKempo.schema){
    try {
      const schemaModule = await import(`${join(extRoot, newKempo.schema)}?t=${Date.now()}`);
      const [err] = await createTablesFromSchema(schemaModule);
      if(err) return [err, null];
    } catch(error){
      return [{ code: 500, msg: `Failed to load extension schema: ${error.message}` }, null];
    }
  }

  /*
    Run update script with diff context
  */
  try {
    const updateModule = await import(`${join(extRoot, 'update.js')}?t=${Date.now()}`).catch(() => null);
    if(updateModule?.default){
      await updateModule.default({ oldVersion, newVersion: pkg.version, oldKempo, newKempo });
    }
  } catch(error){
    return [{ code: 500, msg: `Extension update script failed: ${error.message}` }, null];
  }

  /*
    Add new permissions (never delete — user data may depend on them)
  */
  const oldPermNames = new Set((oldKempo.permissions || []).map(p => p.name));
  for(const { name: permName, description } of newKempo.permissions || []){
    if(!oldPermNames.has(permName)){
      await db.insert(permission).values({
        name: permName,
        description: description || null,
        owner: name,
        createdAt: new Date(),
      }).onConflictDoNothing();
    }
  }

  /*
    Add new settings only (never overwrite — user may have changed the value)
  */
  const oldSettingNames = new Set((oldKempo.settings || []).map(s => s.name));
  for(const { name: settingName, value, type, description } of newKempo.settings || []){
    if(!oldSettingNames.has(settingName)){
      await setSetting(name, settingName, declaredValue(value, type), type || null, false, description || null);
    }
  }

  /*
    Add new groups
  */
  const oldGroupNames = new Set((oldKempo.groups || []).map(g => g.name));
  for(const { name: groupName, description, permissions: groupPerms = [] } of newKempo.groups || []){
    if(!oldGroupNames.has(groupName)){
      await db.insert(group).values({
        name: groupName,
        description: description || null,
        owner: name,
        createdAt: new Date(),
      }).onConflictDoNothing();
      for(const permName of groupPerms){
        await db.insert(groupPermission).values({
          id: randomUUID(),
          groupName,
          permissionName: permName,
          createdAt: new Date(),
        }).onConflictDoNothing();
      }
    }
  }

  /*
    Sync hooks: add new, remove deleted
  */
  const oldHooks = oldKempo.hooks || {};
  const newHooks = newKempo.hooks || {};
  for(const [event, callback] of Object.entries(newHooks)){
    if(!oldHooks[event]){
      await createHook({ owner: name, event, callback });
    }
  }
  for(const event of Object.keys(oldHooks)){
    if(!newHooks[event]){
      await db.delete(hook).where(and(eq(hook.owner, name), eq(hook.event, event))).catch(() => {});
    }
  }

  /*
    Sync dashboard widgets: register or refresh every declared one, remove those no longer declared
  */
  const newWidgetKeys = new Set((newKempo.widgets || []).map(w => w.key));
  for(const widget of newKempo.widgets || []){
    const [widgetError] = await registerDashboardWidget({ ...widget, owner: name });
    if(widgetError){
      console.warn(`[${name}] dashboard widget "${widget.key}" was not registered: ${widgetError.msg}`);
    }
  }
  for(const { key } of oldKempo.widgets || []){
    if(!newWidgetKeys.has(key)){
      await unregisterDashboardWidget({ owner: name, key });
    }
  }

  /*
    Sync scheduled jobs: the schedule becomes exactly what is declared now
  */
  if((newKempo.jobs || []).length || (oldKempo.jobs || []).length){
    const [jobsError] = await registerJobs({ owner: name, jobs: newKempo.jobs || [] });
    if(jobsError){
      console.warn(`[${name}] scheduled jobs were not registered: ${jobsError.msg}`);
    }
  }

  const now = new Date();
  try {
    await db.update(extension).set({
      version: pkg.version || null,
      kempo: newKempo,
      updatedAt: now,
    }).where(eq(extension.name, name));
  } catch(error){
    return [{ code: 500, msg: 'Failed to update extension record' }, null];
  }

  clearHandlerCache();
  await triggerHook('extension:updated', { name, oldVersion, newVersion: pkg.version });

  return [null, { name, oldVersion, newVersion: pkg.version }];
};

