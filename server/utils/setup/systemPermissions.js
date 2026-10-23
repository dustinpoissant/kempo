import db from '../../db/index.js';
import { permission } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/*
  The permissions kempo itself defines. A new site gets them when it is set up (seedDatabase), and `ensureSystemPermissions` adds any
  that an older site is missing when the server starts, so a permission added in a later version exists there too. It only adds: one
  that exists is never touched. The Administrators group has every permission without being given each one.
*/
export const SYSTEM_PERMISSIONS = [
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

  { name: 'system:emails:read', description: 'View the log of emails, including what they said' },
  { name: 'system:emails:manage', description: 'Send a test email and try failed emails again' },

  { name: 'system:admin:access', description: 'Access admin panel' },
];

/* Resolves to [error, { added: [names] }]. */
export const ensureSystemPermissions = async () => {
  try {
    const added = [];
    for(const perm of SYSTEM_PERMISSIONS){
      const [existing] = await db.select({ name: permission.name }).from(permission).where(eq(permission.name, perm.name)).limit(1);
      if(existing) continue;
      await db.insert(permission).values({ name: perm.name, description: perm.description, owner: 'system', createdAt: new Date() });
      added.push(perm.name);
    }
    return [null, { added }];
  } catch {
    return [{ code: 500, msg: 'The system permissions could not be checked' }, null];
  }
};
