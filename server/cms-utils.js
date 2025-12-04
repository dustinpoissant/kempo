import { join } from 'path';
import { pathToFileURL } from 'url';

/*
  Permission Checking Utilities
*/

export const checkPermission = async (request, resource, actions) => {
  const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
  const { auth } = authModule;

  try {
    const result = await auth.api.hasPermission({
      headers: request.headers,
      body: {
        permissions: {
          [resource]: actions
        }
      }
    });

    return result?.success === true;
  } catch(error) {
    console.error('Permission check error:', error);
    return false;
  }
};

export const requirePermission = async (request, response, resource, actions) => {
  const allowed = await checkPermission(request, resource, actions);
  
  if(!allowed) {
    response.status(403).json({ error: 'Insufficient permissions' });
    return false;
  }
  
  return true;
};

/*
  Default Organization Management
*/

const DEFAULT_ORG_SLUG = 'site';
const DEFAULT_ORG_NAME = 'Site';

export const getOrCreateDefaultOrganization = async () => {
  const dbModule = await import(pathToFileURL(join(process.cwd(), 'server', 'db', 'index.js')).href);
  const db = dbModule.default;
  const schema = await import(pathToFileURL(join(process.cwd(), 'server', 'db', 'schema.js')).href);
  const { eq } = await import('drizzle-orm');

  const existing = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.slug, DEFAULT_ORG_SLUG))
    .limit(1);

  if(existing.length > 0) {
    return existing[0];
  }

  const [newOrg] = await db
    .insert(schema.organization)
    .values({
      id: crypto.randomUUID(),
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG,
      createdAt: new Date()
    })
    .returning();

  return newOrg;
};

export const addUserToDefaultOrganization = async (userId, role = 'subscriber') => {
  const dbModule = await import(pathToFileURL(join(process.cwd(), 'server', 'db', 'index.js')).href);
  const db = dbModule.default;
  const schema = await import(pathToFileURL(join(process.cwd(), 'server', 'db', 'schema.js')).href);
  const { eq } = await import('drizzle-orm');

  const org = await getOrCreateDefaultOrganization();

  const existingMember = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .limit(1);

  if(existingMember.length > 0) {
    return existingMember[0];
  }

  const [member] = await db
    .insert(schema.member)
    .values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId,
      role,
      createdAt: new Date()
    })
    .returning();

  return member;
};

export const ensureUserHasOrganization = async (userId) => {
  const dbModule = await import(pathToFileURL(join(process.cwd(), 'server', 'db', 'index.js')).href);
  const db = dbModule.default;
  const schema = await import(pathToFileURL(join(process.cwd(), 'server', 'db', 'schema.js')).href);
  const { eq } = await import('drizzle-orm');

  const members = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .limit(1);

  if(members.length === 0) {
    await addUserToDefaultOrganization(userId);
  }
};
