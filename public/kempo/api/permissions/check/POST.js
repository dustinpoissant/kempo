import { join } from 'path';
import { pathToFileURL } from 'url';
import db from '../../../../../server/db/index.js';
import { member, rolePermission, permission } from '../../../../../server/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

export default async (request, response) => {
  try {
    const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
    const { auth } = authModule;
    const cmsUtils = await import(pathToFileURL(join(process.cwd(), 'server', 'cms-utils.js')).href);

    const session = await auth.api.getSession({ headers: request.headers });
    
    if(!session || !session.user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const body = await request.json();
    const { permissions: permissionsToCheck } = body;

    if(!permissionsToCheck || !Array.isArray(permissionsToCheck)) {
      return response.status(400).json({ error: 'permissions array required' });
    }

    const org = await cmsUtils.getOrCreateDefaultOrganization();
    
    const memberRecord = await db.select()
      .from(member)
      .where(and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, org.id)
      ))
      .limit(1);

    if(memberRecord.length === 0) {
      return response.json({ hasPermission: false, permissions: {} });
    }

    const userRole = memberRecord[0].role;

    const rolePerms = await db.select({ permission })
      .from(rolePermission)
      .leftJoin(permission, eq(rolePermission.permissionId, permission.id))
      .where(eq(rolePermission.role, userRole));

    const userPermissions = new Set(rolePerms.map(rp => rp.permission.name));

    const result = {};
    for(const perm of permissionsToCheck) {
      result[perm] = userPermissions.has(perm);
    }

    const hasAll = permissionsToCheck.every(p => result[p]);

    response.json({ 
      hasPermission: hasAll,
      permissions: result,
      role: userRole
    });
  } catch(error) {
    console.error('Check permission error:', error);
    response.status(500).json({ error: error.message });
  }
};
