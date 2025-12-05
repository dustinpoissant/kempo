import { join } from 'path';
import { pathToFileURL } from 'url';

export default async (request, response) => {
  const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
  const { auth } = authModule;
  const cmsUtils = await import(pathToFileURL(join(process.cwd(), 'server', 'cms-utils.js')).href);

  try {
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
    
    // Set status and headers from auth response
    response.status(authResponse.status);
    authResponse.headers.forEach((value, key) => {
      response.set(key, value);
    });
    response.send(text);
  } catch(error) {
    // Only log actual errors, not auth failures
    if(error.statusCode !== 401) {
      console.error('Login error:', error);
    }
    // Return the actual status code if available, otherwise 500
    const statusCode = error.statusCode || 500;
    response.status(statusCode).json({ error: error.message || 'Internal server error' });
  }
};
