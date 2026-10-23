import crypto from 'crypto';
import db from '../../db/index.js';
import { permission, group, groupPermission, setting, createSettingProtectionTrigger, createGroupProtectionTrigger, createPermissionProtectionTrigger } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { SYSTEM_PERMISSIONS } from './systemPermissions.js';

const DEFAULT_GROUPS = {
  'system:Users': {
    description: 'Default group for all users',
    permissions: []
  },
  'system:Administrators': {
    description: 'Full system access',
    permissions: [
      'system:admin:access',
      'system:user:create', 'system:user:read', 'system:user:update', 'system:user:delete',
      'system:group:create', 'system:group:read', 'system:group:update', 'system:group:delete',
      'system:permissions:list-own', 'system:permissions:check-others', 'system:permissions:list-others', 'system:permissions:manage',
      'system:settings:read', 'system:settings:update', 'system:custom-settings:manage',
      'system:pages:read', 'system:pages:create', 'system:pages:update', 'system:pages:delete',
      'system:menus:create', 'system:menus:read', 'system:menus:update', 'system:menus:delete',
      'system:fragments:read', 'system:fragments:create', 'system:fragments:update', 'system:fragments:delete',
      'system:globals:read', 'system:globals:create', 'system:globals:update', 'system:globals:delete',
      'system:extensions:read', 'system:extensions:install', 'system:extensions:uninstall', 'system:extensions:manage',
      'system:realtime:read', 'system:emails:read', 'system:emails:manage'
    ]
  }
};

/*
  Each trigger definition is a function plus a trigger in one string. node-postgres style drivers send
  that as a simple query; PGlite's execute() prepares it and refuses multiple commands, so it uses exec().
*/
const runScript = text => db.$client?.exec ? db.$client.exec(text) : db.execute(sql.raw(text));

/*
  Seeds the system permissions, groups, settings and the triggers that protect them. Idempotent.
  `scripts/init-db.js` runs it for a site; tests call it in-process so they can share a database
  with the code under test (an in-memory PGlite cannot be reached from a child process).
*/
export default async ({ log = console.log } = {}) => {
  log('=== Seeding Permissions ===\n');

  for(const perm of SYSTEM_PERMISSIONS) {
    const existing = await db.select()
      .from(permission)
      .where(eq(permission.name, perm.name))
      .limit(1);
  
    if(existing.length === 0) {
      await db.insert(permission).values({
        name: perm.name,
        description: perm.description,
        owner: 'system',
        createdAt: new Date()
      });
      log(`✓ Created permission: ${perm.name}`);
    } else {
      log(`- Permission exists: ${perm.name}`);
    }
  }

  log('\n=== Creating Groups ===\n');

  const allPermissions = await db.select().from(permission);
  const permissionMap = Object.fromEntries(
    allPermissions.map(p => [p.name, p.name])
  );

  for(const [groupName, groupData] of Object.entries(DEFAULT_GROUPS)) {
    let groupRecord = await db.select()
      .from(group)
      .where(eq(group.name, groupName))
      .limit(1);
  
    if(groupRecord.length === 0) {
      groupRecord = await db.insert(group).values({
        name: groupName,
        description: groupData.description,
        owner: 'system',
        createdAt: new Date()
      }).returning();
      log(`✓ Created group: ${groupName}`);
    } else {
      log(`- Group exists: ${groupName}`);
    }
  
    if(groupName === 'system:Administrators') {
      log(`  Skipping permission assignments (admin has all permissions)`);
      continue;
    }
  
    log(`  Assigning permissions to ${groupName}:`);
  
    for(const permName of groupData.permissions) {
      if(!permissionMap[permName]) {
        log(`  ⚠ Permission not found: ${permName}`);
        continue;
      }
    
      const existing = await db.select()
        .from(groupPermission)
        .where(and(
          eq(groupPermission.groupName, groupName),
          eq(groupPermission.permissionName, permName)
        ))
        .limit(1);
    
      if(existing.length === 0) {
        await db.insert(groupPermission).values({
          id: crypto.randomUUID(),
          groupName: groupName,
          permissionName: permName,
          createdAt: new Date()
        });
        log(`  ✓ ${permName}`);
      }
    }
  }

  log('\n=== Creating Default Settings ===\n');

  const { SYSTEM_SETTINGS } = await import('../settings/systemSettings.js');

  const { default: setSetting } = await import('../settings/setSetting.js');
  for(const s of SYSTEM_SETTINGS){
    await setSetting(s.owner, s.name, s.value, s.type, s.isPublic, s.description);
    log(`✓ Created setting: ${s.owner}:${s.name} = ${s.value}`);
  }

  log('\n=== Updating Existing Records ===\n');

  const updatedPerms = await db.update(permission)
    .set({ owner: 'system' })
    .where(sql`name LIKE 'system:%'`)
    .returning();
  log(`✓ Updated ${updatedPerms.length} permissions to owner='system'`);

  const updatedGroups = await db.update(group)
    .set({ owner: 'system' })
    .where(sql`name LIKE 'system:%'`)
    .returning();
  log(`✓ Updated ${updatedGroups.length} groups to owner='system'`);

  log('\nCreating database triggers to protect system resources...');

  try {
    await db.execute(sql.raw('DROP TRIGGER IF EXISTS protect_system_settings ON setting'));
    await runScript(createSettingProtectionTrigger());
    log('✓ System settings protection trigger created');
  } catch(e) {
    log('- Settings trigger already exists');
  }

  try {
    await db.execute(sql.raw('DROP TRIGGER IF EXISTS protect_system_groups ON "group"'));
    await runScript(createGroupProtectionTrigger());
    log('✓ System groups protection trigger created');
  } catch(e) {
    log('- Groups trigger already exists');
  }

  try {
    await db.execute(sql.raw('DROP TRIGGER IF EXISTS protect_system_permissions ON permission'));
    await runScript(createPermissionProtectionTrigger());
    log('✓ System permissions protection trigger created');
  } catch(e) {
    log('- Permissions trigger already exists');
  }

  log('\n=== Group & Permission Seeding Complete ===');
};
