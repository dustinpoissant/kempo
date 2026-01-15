import crypto from 'crypto';
import db from '../server/db/index.js';
import { permission, group, groupPermission, setting, createSettingProtectionTrigger, createGroupProtectionTrigger, createPermissionProtectionTrigger } from '../server/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const DEFAULT_PERMISSIONS = [
  { name: 'system:content:create', description: 'Create new content' },
  { name: 'system:content:update', description: 'Edit content' },
  { name: 'system:content:delete', description: 'Delete content' },
  
  { name: 'system:user:create', description: 'Create new users' },
  { name: 'system:user:read', description: 'View users' },
  { name: 'system:user:update', description: 'Edit users' },
  { name: 'system:user:delete', description: 'Delete users' },
  
  { name: 'system:permissions:list-own', description: 'List own permissions' },
  { name: 'system:permissions:check-others', description: 'Check other users permissions' },
  { name: 'system:permissions:list-others', description: 'List other users permissions' },
  { name: 'system:permissions:manage', description: 'Add or remove permissions for any user' },
  
  { name: 'system:extension:install', description: 'Install extensions' },
  { name: 'system:extension:activate', description: 'Activate extensions' },
  { name: 'system:extension:configure', description: 'Configure extensions' },
  { name: 'system:extension:delete', description: 'Delete extensions' },
  
  { name: 'system:settings:read', description: 'View private settings' },
  { name: 'system:settings:update', description: 'Update settings' },
  { name: 'system:custom-settings:manage', description: 'Create and delete custom settings' },
  
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
      'system:content:create', 'system:content:read', 'system:content:update', 'system:content:delete',
      'system:user:create', 'system:user:read', 'system:user:update', 'system:user:delete',
      'system:permissions:list-own', 'system:permissions:check-others', 'system:permissions:list-others', 'system:permissions:manage',
      'system:extension:install', 'system:extension:activate', 'system:extension:configure', 'system:extension:delete',
      'system:settings:read', 'system:settings:update', 'system:custom-settings:manage'
    ]
  }
};

console.log('=== Seeding Permissions ===\n');

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
    console.log(`✓ Created permission: ${perm.name}`);
  } else {
    console.log(`- Permission exists: ${perm.name}`);
  }
}

console.log('\n=== Creating Groups ===\n');

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
    console.log(`✓ Created group: ${groupName}`);
  } else {
    console.log(`- Group exists: ${groupName}`);
  }
  
  if(groupName === 'system:Administrators') {
    console.log(`  Skipping permission assignments (admin has all permissions)`);
    continue;
  }
  
  console.log(`  Assigning permissions to ${groupName}:`);
  
  for(const permName of groupData.permissions) {
    if(!permissionMap[permName]) {
      console.log(`  ⚠ Permission not found: ${permName}`);
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
      console.log(`  ✓ ${permName}`);
    }
  }
}

console.log('\n=== Creating Default Settings ===\n');

const DEFAULT_SETTINGS = [
  { owner: 'system', name: 'site_name', value: 'Kempo Site', type: 'string', isPublic: true, description: 'The name of the website' },
  { owner: 'system', name: 'session_duration_days', value: 7, type: 'number', isPublic: false, description: 'Session duration in days' },
  { owner: 'system', name: 'allow_registration', value: true, type: 'boolean', isPublic: true, description: 'Allow new users to register' },
  { owner: 'system', name: 'require_email_verification', value: false, type: 'boolean', isPublic: false, description: 'Require email verification before account access' },
  { owner: 'system', name: 'verification_url', value: 'http://localhost:3000/verify-email/{{token}}', type: 'string', isPublic: false, description: 'Email verification URL template' },
  { owner: 'system', name: 'password_reset_url', value: 'http://localhost:3000/reset-password/{{token}}', type: 'string', isPublic: false, description: 'Password reset URL template' },
];

const { setSetting } = await import('../server/utils/settings/settings.js');
for(const s of DEFAULT_SETTINGS){
  await setSetting(s.owner, s.name, s.value, s.type, s.isPublic, s.description);
  console.log(`✓ Created setting: ${s.owner}:${s.name} = ${s.value}`);
}

console.log('\n=== Updating Existing Records ===\n');

const updatedPerms = await db.update(permission)
  .set({ owner: 'system' })
  .where(sql`name LIKE 'system:%'`)
  .returning();
console.log(`✓ Updated ${updatedPerms.length} permissions to owner='system'`);

const updatedGroups = await db.update(group)
  .set({ owner: 'system' })
  .where(sql`name LIKE 'system:%'`)
  .returning();
console.log(`✓ Updated ${updatedGroups.length} groups to owner='system'`);

console.log('\nCreating database triggers to protect system resources...');

try {
  await db.execute(sql.raw('DROP TRIGGER IF EXISTS protect_system_settings ON setting'));
  await db.execute(sql.raw(createSettingProtectionTrigger()));
  console.log('✓ System settings protection trigger created');
} catch(e) {
  console.log('- Settings trigger already exists');
}

try {
  await db.execute(sql.raw('DROP TRIGGER IF EXISTS protect_system_groups ON "group"'));
  await db.execute(sql.raw(createGroupProtectionTrigger()));
  console.log('✓ System groups protection trigger created');
} catch(e) {
  console.log('- Groups trigger already exists');
}

try {
  await db.execute(sql.raw('DROP TRIGGER IF EXISTS protect_system_permissions ON permission'));
  await db.execute(sql.raw(createPermissionProtectionTrigger()));
  console.log('✓ System permissions protection trigger created');
} catch(e) {
  console.log('- Permissions trigger already exists');
}

console.log('\n=== Group & Permission Seeding Complete ===');
process.exit(0);
