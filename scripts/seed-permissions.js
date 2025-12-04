import db from '../server/db/index.js';
import { permission, rolePermission } from '../server/db/schema.js';
import { eq, and } from 'drizzle-orm';

const DEFAULT_PERMISSIONS = [
  { resource: 'content', action: 'create', description: 'Create new content' },
  { resource: 'content', action: 'read', description: 'View content' },
  { resource: 'content', action: 'update', description: 'Edit content' },
  { resource: 'content', action: 'delete', description: 'Delete content' },
  { resource: 'content', action: 'publish', description: 'Publish content' },
  
  { resource: 'page', action: 'create', description: 'Create new pages' },
  { resource: 'page', action: 'read', description: 'View pages' },
  { resource: 'page', action: 'update', description: 'Edit pages' },
  { resource: 'page', action: 'delete', description: 'Delete pages' },
  { resource: 'page', action: 'publish', description: 'Publish pages' },
  
  { resource: 'media', action: 'upload', description: 'Upload media files' },
  { resource: 'media', action: 'read', description: 'View media files' },
  { resource: 'media', action: 'update', description: 'Edit media files' },
  { resource: 'media', action: 'delete', description: 'Delete media files' },
  
  { resource: 'user', action: 'create', description: 'Create new users' },
  { resource: 'user', action: 'read', description: 'View users' },
  { resource: 'user', action: 'update', description: 'Edit users' },
  { resource: 'user', action: 'delete', description: 'Delete users' },
  
  { resource: 'comment', action: 'create', description: 'Create comments' },
  { resource: 'comment', action: 'read', description: 'View comments' },
  { resource: 'comment', action: 'update', description: 'Edit comments' },
  { resource: 'comment', action: 'delete', description: 'Delete comments' },
  { resource: 'comment', action: 'moderate', description: 'Moderate comments' },
  
  { resource: 'plugin', action: 'install', description: 'Install plugins' },
  { resource: 'plugin', action: 'activate', description: 'Activate plugins' },
  { resource: 'plugin', action: 'configure', description: 'Configure plugins' },
  { resource: 'plugin', action: 'delete', description: 'Delete plugins' },
  
  { resource: 'theme', action: 'install', description: 'Install themes' },
  { resource: 'theme', action: 'activate', description: 'Activate themes' },
  { resource: 'theme', action: 'configure', description: 'Configure themes' },
  { resource: 'theme', action: 'delete', description: 'Delete themes' },
  
  { resource: 'settings', action: 'read', description: 'View settings' },
  { resource: 'settings', action: 'update', description: 'Update settings' },
];

const ROLE_PERMISSIONS = {
  superAdmin: [
    'content:create', 'content:read', 'content:update', 'content:delete', 'content:publish',
    'page:create', 'page:read', 'page:update', 'page:delete', 'page:publish',
    'media:upload', 'media:read', 'media:update', 'media:delete',
    'user:create', 'user:read', 'user:update', 'user:delete',
    'comment:create', 'comment:read', 'comment:update', 'comment:delete', 'comment:moderate',
    'plugin:install', 'plugin:activate', 'plugin:configure', 'plugin:delete',
    'theme:install', 'theme:activate', 'theme:configure', 'theme:delete',
    'settings:read', 'settings:update'
  ],
  admin: [
    'content:create', 'content:read', 'content:update', 'content:delete', 'content:publish',
    'page:create', 'page:read', 'page:update', 'page:delete', 'page:publish',
    'media:upload', 'media:read', 'media:update', 'media:delete',
    'user:create', 'user:read', 'user:update',
    'comment:create', 'comment:read', 'comment:update', 'comment:delete', 'comment:moderate',
    'settings:read'
  ],
  editor: [
    'content:create', 'content:read', 'content:update', 'content:delete', 'content:publish',
    'page:create', 'page:read', 'page:update', 'page:delete', 'page:publish',
    'media:upload', 'media:read', 'media:update', 'media:delete',
    'comment:create', 'comment:read', 'comment:update', 'comment:delete', 'comment:moderate'
  ],
  contributor: [
    'content:create', 'content:read', 'content:update',
    'page:create', 'page:read', 'page:update',
    'media:upload', 'media:read',
    'comment:create', 'comment:read', 'comment:update'
  ],
  subscriber: [
    'content:read',
    'page:read',
    'comment:create', 'comment:read'
  ]
};

console.log('=== Seeding Permissions ===\n');

for(const perm of DEFAULT_PERMISSIONS) {
  const name = `${perm.resource}:${perm.action}`;
  
  const existing = await db.select()
    .from(permission)
    .where(eq(permission.name, name))
    .limit(1);
  
  if(existing.length === 0) {
    await db.insert(permission).values({
      id: crypto.randomUUID(),
      name,
      resource: perm.resource,
      action: perm.action,
      description: perm.description,
      createdAt: new Date()
    });
    console.log(`✓ Created permission: ${name}`);
  } else {
    console.log(`- Permission exists: ${name}`);
  }
}

console.log('\n=== Assigning Permissions to Roles ===\n');

const allPermissions = await db.select().from(permission);
const permissionMap = Object.fromEntries(
  allPermissions.map(p => [p.name, p.id])
);

for(const [role, permNames] of Object.entries(ROLE_PERMISSIONS)) {
  console.log(`\nRole: ${role}`);
  
  for(const permName of permNames) {
    const permId = permissionMap[permName];
    if(!permId) {
      console.log(`  ⚠ Permission not found: ${permName}`);
      continue;
    }
    
    const existing = await db.select()
      .from(rolePermission)
      .where(and(
        eq(rolePermission.role, role),
        eq(rolePermission.permissionId, permId)
      ))
      .limit(1);
    
    if(existing.length === 0) {
      await db.insert(rolePermission).values({
        id: crypto.randomUUID(),
        role,
        permissionId: permId,
        createdAt: new Date()
      });
      console.log(`  ✓ Assigned: ${permName}`);
    }
  }
}

console.log('\n=== Permission Seeding Complete ===');
process.exit(0);
