import { join } from 'path';
import { pathToFileURL } from 'url';

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
    const org = await cmsUtils.getOrCreateDefaultOrganization();
    
    const result = await auth.api.inviteMember({
      headers: request.headers,
      body: {
        email: body.email,
        role: body.role,
        organizationId: org.id
      }
    });
    
    response.json(result);
  } catch(error) {
    console.error('Invite member error:', error);
    response.status(500).json({ error: error.message });
  }
};
