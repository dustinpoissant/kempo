import db from '../../db/index.js';
import { extension, hook, permission, group, groupPermission } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { randomUUID } from 'crypto';
import triggerHook, { clearHandlerCache } from '../hooks/triggerHook.js';
import createHook from '../hooks/createHook.js';
import registerDashboardWidget from '../dashboard/registerDashboardWidget.js';
import unregisterDashboardWidget from '../dashboard/unregisterDashboardWidget.js';
import registerJobs from '../scheduler/registerJobs.js';
import setSetting from '../settings/setSetting.js';
import declaredValue from '../settings/declaredValue.js';
import syncCoreSchema from '../setup/syncCoreSchema.js';
import readKempoConfig from './readKempoConfig.js';
import { invalidateScopeCache } from './scopeCache.js';

/*
  Brings the database in step with a newer version of an extension that is already on disk: its tables (additions only: new
  tables, columns and indexes), its own `update.js` (given the old and new version and what each declared), and whatever the
  new version declares that the old one did not (permissions, settings, groups, hooks, dashboard widgets and scheduled jobs).
  It only adds: a permission, setting or group an extension no longer declares stays, because data may depend on it, and a
  setting the owner changed keeps their value. Hooks, widgets and jobs follow what is declared now.

  `record` is the extension's row as it was before. Resolves to [error, { name, oldVersion, newVersion }]. Run by the startup
  step (reconcileExtensions) and by updateExtension, never on a version that is older than the row's.
*/
export default async ({ name, record, extRoot = join(process.cwd(), 'node_modules', name) }) => {
  const oldKempo = record.kempo || {};
  const oldVersion = record.version;

  let pkg, newKempo;
  try {
    ({ pkg, kempo: newKempo } = await readKempoConfig(extRoot));
  } catch {
    return [{ code: 404, msg: `Package "${name}" is not installed` }, null];
  }

  if(newKempo.schema){
    try {
      const schemaModule = await import(`${pathToFileURL(join(extRoot, newKempo.schema)).href}?t=${Date.now()}`);
      const [schemaError, synced] = await syncCoreSchema({ schema: schemaModule });
      if(schemaError) return [schemaError, null];
      for(const { change, reason } of synced.failed) console.warn(`[${name}] database change not applied: ${change}: ${reason}`);
    } catch(error) {
      return [{ code: 500, msg: `Failed to load extension schema: ${error.message}` }, null];
    }
  }

  try {
    const updateModule = await import(`${pathToFileURL(join(extRoot, 'update.js')).href}?t=${Date.now()}`).catch(() => null);
    if(updateModule?.default){
      await updateModule.default({ oldVersion, newVersion: pkg.version, oldKempo, newKempo });
    }
  } catch(error) {
    return [{ code: 500, msg: `Extension update script failed: ${error.message}` }, null];
  }

  const oldPermNames = new Set((oldKempo.permissions || []).map(p => p.name));
  for(const { name: permName, description } of newKempo.permissions || []){
    if(!oldPermNames.has(permName)){
      await db.insert(permission).values({ name: permName, description: description || null, owner: name, createdAt: new Date() }).onConflictDoNothing();
    }
  }

  const oldSettingNames = new Set((oldKempo.settings || []).map(s => s.name));
  for(const { name: settingName, value, type, description } of newKempo.settings || []){
    if(!oldSettingNames.has(settingName)){
      await setSetting(name, settingName, declaredValue(value, type), type || null, false, description || null);
    }
  }

  const oldGroupNames = new Set((oldKempo.groups || []).map(g => g.name));
  for(const { name: groupName, description, permissions: groupPerms = [] } of newKempo.groups || []){
    if(!oldGroupNames.has(groupName)){
      await db.insert(group).values({ name: groupName, description: description || null, owner: name, createdAt: new Date() }).onConflictDoNothing();
      for(const permName of groupPerms){
        await db.insert(groupPermission).values({ id: randomUUID(), groupName, permissionName: permName, createdAt: new Date() }).onConflictDoNothing();
      }
    }
  }

  const oldHooks = oldKempo.hooks || {};
  const newHooks = newKempo.hooks || {};
  for(const [event, callback] of Object.entries(newHooks)){
    if(!oldHooks[event]) await createHook({ owner: name, event, callback });
  }
  for(const event of Object.keys(oldHooks)){
    if(!newHooks[event]) await db.delete(hook).where(and(eq(hook.owner, name), eq(hook.event, event))).catch(() => {});
  }

  const newWidgetKeys = new Set((newKempo.widgets || []).map(w => w.key));
  for(const widget of newKempo.widgets || []){
    const [widgetError] = await registerDashboardWidget({ ...widget, owner: name });
    if(widgetError) console.warn(`[${name}] dashboard widget "${widget.key}" was not registered: ${widgetError.msg}`);
  }
  for(const { key } of oldKempo.widgets || []){
    if(!newWidgetKeys.has(key)) await unregisterDashboardWidget({ owner: name, key });
  }

  if((newKempo.jobs || []).length || (oldKempo.jobs || []).length){
    const [jobsError] = await registerJobs({ owner: name, jobs: newKempo.jobs || [] });
    if(jobsError) console.warn(`[${name}] scheduled jobs were not registered: ${jobsError.msg}`);
  }

  try {
    await db.update(extension).set({ version: pkg.version || null, kempo: newKempo, updatedAt: new Date() }).where(eq(extension.name, name));
  } catch {
    return [{ code: 500, msg: 'Failed to update extension record' }, null];
  }

  clearHandlerCache();
  invalidateScopeCache();
  await triggerHook('extension:updated', { name, oldVersion, newVersion: pkg.version });

  return [null, { name, oldVersion, newVersion: pkg.version }];
};
