import db from '../../db/index.js';
import { extension, hook, permission, group, groupPermission } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import triggerHook, { clearHandlerCache } from '../hooks/triggerHook.js';
import createHook from '../hooks/createHook.js';
import setSetting from '../settings/setSetting.js';
import createTablesFromSchema from './createTablesFromSchema.js';
import { invalidateScopeCache } from './scopeCache.js';

const requireFromProject = createRequire(join(process.cwd(), 'package.json'));

export default async ({ name }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
  }

  try {
    const existing = await db.select().from(extension).where(eq(extension.name, name)).limit(1);
    if(existing.length){
      return [{ code: 409, msg: 'Extension is already installed' }, null];
    }
  } catch(error) {
    return [{ code: 500, msg: 'Failed to check existing extensions' }, null];
  }

  let pkgPath, extRoot, pkg;
  try {
    pkgPath = requireFromProject.resolve(`${name}/package.json`);
    extRoot = dirname(pkgPath);
    pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  } catch {
    return [{ code: 404, msg: `Extension package "${name}" not found` }, null];
  }

  const kempoConfig = pkg.kempo || {};

  /*
    Create tables from declarative schema
  */
  if(kempoConfig.schema){
    try {
      const schemaModule = await import(join(extRoot, kempoConfig.schema));
      const [err] = await createTablesFromSchema(schemaModule);
      if(err) return [err, null];
    } catch(error){
      return [{ code: 500, msg: `Failed to load extension schema: ${error.message}` }, null];
    }
  }

  /*
    Run install script
  */
  try {
    const installModule = await import(join(extRoot, 'install.js')).catch(() => null);
    if(installModule?.default){
      await installModule.default();
    }
  } catch(error) {
    return [{ code: 500, msg: `Extension install script failed: ${error.message}` }, null];
  }

  /*
    Create declarative permissions
  */
  for(const { name: permName, description } of kempoConfig.permissions || []){
    await db.insert(permission).values({
      name: permName,
      description: description || null,
      owner: name,
      createdAt: new Date(),
    }).onConflictDoNothing();
  }

  /*
    Create declarative settings
  */
  for(const { name: settingName, value, type, description } of kempoConfig.settings || []){
    await setSetting(name, settingName, value, type || null, false, description || null);
  }

  /*
    Create declarative groups with permissions
  */
  for(const { name: groupName, description, permissions: groupPerms = [] } of kempoConfig.groups || []){
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

  /*
    Register hooks from declarative config
  */
  for(const [event, callback] of Object.entries(kempoConfig.hooks || {})){
    await createHook({ owner: name, event, callback });
  }

  const now = new Date();
  const entry = {
    name,
    version: pkg.version || null,
    enabled: true,
    kempo: kempoConfig,
    installedAt: now,
    updatedAt: now,
  };

  try {
    await db.insert(extension).values(entry);
  } catch(error) {
    return [{ code: 500, msg: 'Failed to register extension' }, null];
  }

  clearHandlerCache();
  invalidateScopeCache();
  await triggerHook('extension:installed', { name, version: pkg.version });

  return [null, entry];
};

