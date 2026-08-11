import db from '../../db/index.js';
import { extension, hook, permission, setting, group, groupPermission, userGroup } from '../../db/schema.js';
import { eq, inArray, like } from 'drizzle-orm';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { sql } from 'drizzle-orm';
import triggerHook, { clearHandlerCache } from '../hooks/triggerHook.js';
import { invalidateScopeCache } from './scopeCache.js';

/*
  Uninstall an extension.

  `purgeData` false (the default) deregisters the extension but leaves everything it created in
  place — its tables and their rows, group memberships, permissions, groups and settings — so
  reinstalling restores the site exactly as it was. This is the right mode for reinstalling to pick
  up a fix.

  `purgeData` true additionally destroys all of that. For an extension like kempo-blog that means
  every post and comment, so it must always be a deliberate choice rather than a default.

  Hooks and the extension row are removed either way. A registered hook whose module is no longer
  installed cannot be tolerated: `middleware:before_page` is triggered with `bail: true`, so a
  handler that fails to import now aborts the render and every page 404s.
*/
export default async ({ name, purgeData = false }) => {
  if(!name){
    return [{ code: 400, msg: 'Extension name is required' }, null];
  }

  let kempoConfig;
  try {
    const [existing] = await db.select().from(extension).where(eq(extension.name, name)).limit(1);
    if(!existing){
      return [{ code: 404, msg: 'Extension not found' }, null];
    }
    kempoConfig = existing.kempo || {};
  } catch(error) {
    return [{ code: 500, msg: 'Failed to find extension' }, null];
  }

  try {
    const extRoot = join(process.cwd(), 'node_modules', name);
    const uninstallModule = await import(pathToFileURL(join(extRoot, 'uninstall.js')).href + `?t=${Date.now()}`).catch(() => null);
    if(uninstallModule?.default){
      await uninstallModule.default();
    }
  } catch {}

  /*
    Drop declarative schema tables. Only when purging — these hold the extension's actual content.
  */
  if(purgeData && kempoConfig.schema){
    try {
      const extRoot = join(process.cwd(), 'node_modules', name);
      const schemaModule = await import(pathToFileURL(join(extRoot, kempoConfig.schema)).href);
      const { getTableConfig } = await import('drizzle-orm/pg-core');
      for(const exported of Object.values(schemaModule)){
        if(typeof exported !== 'object' || !exported?.[Symbol.for('drizzle:Name')]) continue;
        const { name: tableName } = getTableConfig(exported);
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${tableName}" CASCADE`));
      }
    } catch {}
  }

  /*
    Remove declarative groups, permissions and settings. Only when purging: these are what a
    reinstall would otherwise restore, and group memberships in particular represent real user
    state — every registered user of kempo-blog belongs to kempo-blog:member.

    userGroup and groupPermission both reference group.name, and groupPermission also references
    permission.name, none of them cascading. The membership and grant rows therefore have to go
    first or these deletes fail the foreign key — which they used to do silently, leaving every
    uninstalled extension's groups and permissions behind forever.
  */
  if(purgeData){
    const groupNames = (kempoConfig.groups || []).map(g => g.name);
    const permNames = (kempoConfig.permissions || []).map(p => p.name);

    try {
      if(groupNames.length){
        await db.delete(userGroup).where(inArray(userGroup.groupName, groupNames));
        await db.delete(groupPermission).where(inArray(groupPermission.groupName, groupNames));
      }
      if(permNames.length){
        await db.delete(groupPermission).where(inArray(groupPermission.permissionName, permNames));
      }
      if(groupNames.length){
        await db.delete(group).where(inArray(group.name, groupNames));
      }
      if(permNames.length){
        await db.delete(permission).where(inArray(permission.name, permNames));
      }
    } catch(error) {
      return [{ code: 500, msg: `Failed to remove extension groups and permissions: ${error.message}` }, null];
    }

    /*
      Ownership is encoded in the setting name as "extname:settingname" — the setting table has no
      owner column, so these have to be matched by prefix.
    */
    await db.delete(setting).where(like(setting.name, `${name}:%`));
  }

  try {
    await db.delete(hook).where(eq(hook.owner, name));
    await db.delete(extension).where(eq(extension.name, name));
  } catch(error) {
    return [{ code: 500, msg: 'Failed to remove extension' }, null];
  }

  clearHandlerCache();
  invalidateScopeCache();
  await triggerHook('extension:uninstalled', { name });

  return [null, { success: true }];
};

