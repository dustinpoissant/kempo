import crypto from 'crypto';
import db from '../../db/index.js';
import { permission, group, groupPermission, setting, createSettingProtectionTrigger, createGroupProtectionTrigger, createPermissionProtectionTrigger } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const DEFAULT_PERMISSIONS = [
  { name: 'system:user:create', description: 'Create new users' },
  { name: 'system:user:read', description: 'View users' },
  { name: 'system:user:update', description: 'Edit users' },
  { name: 'system:user:delete', description: 'Delete users' },
  
  { name: 'system:group:create', description: 'Create new groups' },
  { name: 'system:group:read', description: 'View groups' },
  { name: 'system:group:update', description: 'Edit groups and manage membership' },
  { name: 'system:group:delete', description: 'Delete groups' },
  
  { name: 'system:permissions:read', description: 'View permissions for all users' },
  { name: 'system:permissions:manage', description: 'Add or remove permissions' },
  
  { name: 'system:settings:read', description: 'View private settings' },
  { name: 'system:settings:update', description: 'Update settings' },
  { name: 'system:custom-settings:manage', description: 'Create and delete custom settings' },
  
  { name: 'system:pages:read', description: 'View pages in admin' },
  { name: 'system:pages:create', description: 'Create new pages' },
  { name: 'system:pages:update', description: 'Edit pages' },
  { name: 'system:pages:delete', description: 'Delete pages' },
  
  { name: 'system:menus:create', description: 'Create new menus' },
  { name: 'system:menus:read', description: 'View menus in admin' },
  { name: 'system:menus:update', description: 'Edit menus and menu items' },
  { name: 'system:menus:delete', description: 'Delete menus' },
  
  { name: 'system:fragments:read', description: 'View fragments in admin' },
  { name: 'system:fragments:create', description: 'Create new fragments' },
  { name: 'system:fragments:update', description: 'Edit fragments' },
  { name: 'system:fragments:delete', description: 'Delete fragments' },
  
  { name: 'system:globals:read', description: 'View global content in admin' },
  { name: 'system:globals:create', description: 'Create new global content' },
  { name: 'system:globals:update', description: 'Edit global content' },
  { name: 'system:globals:delete', description: 'Delete global content' },

  { name: 'system:extensions:read', description: 'View installed extensions' },
  { name: 'system:extensions:install', description: 'Install extensions' },
  { name: 'system:extensions:uninstall', description: 'Uninstall extensions' },
  { name: 'system:extensions:manage', description: 'Enable and disable extensions' },

  { name: 'system:realtime:read', description: 'View realtime connections and channels' },

  { name: 'system:admin:access', description: 'Access admin panel' },
];

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
      'system:realtime:read'
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

  for(const perm of DEFAULT_PERMISSIONS) {
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

  const DEFAULT_SETTINGS = [
    { owner: 'system', name: 'site_name', value: 'Kempo Site', type: 'string', isPublic: true, description: 'The name of the website' },
    { owner: 'system', name: 'session_duration_days', value: 7, type: 'number', isPublic: false, description: 'Session duration in days' },
    { owner: 'system', name: 'allow_registration', value: true, type: 'boolean', isPublic: true, description: 'Allow new users to register' },
    { owner: 'system', name: 'require_email_verification', value: false, type: 'boolean', isPublic: false, description: 'Require email verification before account access' },
    { owner: 'system', name: 'verification_url', value: 'http://localhost:3000/verify-email/{{token}}', type: 'string', isPublic: false, description: 'Email verification URL template' },
    { owner: 'system', name: 'notification_retention_days', value: 90, type: 'number', isPublic: false, description: 'Days to keep notifications before they are deleted (0 keeps them forever)' },
    { owner: 'system', name: 'password_reset_url', value: 'http://localhost:3000/reset-password/{{token}}', type: 'string', isPublic: false, description: 'Password reset URL template' },
  ];

  const { default: setSetting } = await import('../settings/setSetting.js');
  for(const s of DEFAULT_SETTINGS){
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
