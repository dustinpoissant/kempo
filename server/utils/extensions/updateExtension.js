import db from '../../db/index.js';
import { extension, hook, permission, group, groupPermission } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import triggerHook, { clearHandlerCache } from '../hooks/triggerHook.js';
import createHook from '../hooks/createHook.js';
import setSetting from '../settings/setSetting.js';
import createTablesFromSchema from './createTablesFromSchema.js';

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

  let pkgPath, extRoot, pkg;
  try {
    pkgPath = requireFromProject.resolve(`${name}/package.json`);
    extRoot = dirname(pkgPath);
    pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  } catch {
    return [{ code: 404, msg: `Updated package "${name}" not found` }, null];
  }

  const newKempo = pkg.kempo || {};

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
      await setSetting(name, settingName, value, type || null, false, description || null);
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

