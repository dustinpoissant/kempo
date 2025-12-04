import { join } from 'path';
import { pathToFileURL } from 'url';

export default async (request, response) => {
  try {
    const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
    const { auth } = authModule;
    const cmsUtils = await import(pathToFileURL(join(process.cwd(), 'server', 'cms-utils.js')).href);

    const body = await request.json();
    const authRequest = new Request(`${auth.options.baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const authResponse = await auth.handler(authRequest);
    const text = await authResponse.text();
    
    if(authResponse.ok) {
      const data = JSON.parse(text);
      if(data.user?.id) {
        await cmsUtils.ensureUserHasOrganization(data.user.id);
        
        const org = await cmsUtils.getOrCreateDefaultOrganization();
        await auth.api.setActiveOrganization({
          body: {
            organizationId: org.id
          },
          headers: authResponse.headers
        });
      }
    }
    
    response.status(authResponse.status);
    authResponse.headers.forEach((value, key) => {
      response.set(key, value);
    });
    response.send(text);
  } catch(error) {
    console.error('Login error:', error);
    response.status(500).json({ error: error.message });
  }
};
