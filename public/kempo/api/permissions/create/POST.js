import { join } from 'path';
import { pathToFileURL } from 'url';
import db from '../../../../../server/db/index.js';
import { permission } from '../../../../../server/db/schema.js';
import { eq } from 'drizzle-orm';

export default async (request, response) => {
  try {
    const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
    const { auth } = authModule;
    const cmsUtils = await import(pathToFileURL(join(process.cwd(), 'server', 'cms-utils.js')).href);

    const session = await auth.api.getSession({ headers: request.headers });
    
    if(!session || !session.user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const hasAccess = await cmsUtils.checkPermission(request, 'settings', ['update']);
    if(!hasAccess) {
      return response.status(403).json({ error: 'Insufficient permissions' });
    }

    const body = await request.json();
    const { name, resource, action, description } = body;

    if(!name || !resource || !action) {
      return response.status(400).json({ error: 'name, resource, and action required' });
    }

    const existing = await db.select()
      .from(permission)
      .where(eq(permission.name, name))
      .limit(1);

    if(existing.length > 0) {
      return response.status(409).json({ error: 'Permission already exists' });
    }

    const [newPermission] = await db.insert(permission).values({
      id: crypto.randomUUID(),
      name,
      resource,
      action,
      description: description || null,
      createdAt: new Date()
    }).returning();

    response.json({ permission: newPermission });
  } catch(error) {
    console.error('Create permission error:', error);
    response.status(500).json({ error: error.message });
  }
};
