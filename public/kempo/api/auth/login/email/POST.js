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

    console.log('[LOGIN] Attempting login for:', body.email);
    const authResponse = await auth.handler(authRequest);
    console.log('[LOGIN] Auth response status:', authResponse.status);
    const text = await authResponse.text();
    console.log('[LOGIN] Auth response body:', text);
    
    // If login failed, return the error immediately without processing
    if(!authResponse.ok){
      response.status(authResponse.status);
      authResponse.headers.forEach((value, key) => {
        response.set(key, value);
      });
      return response.send(text);
    }
    
    // Login successful, set up organization (do this asynchronously, don't block login)
    const data = JSON.parse(text);
    if(data.user?.id) {
      // Ensure user has organization but don't wait for it or set active org here
      // The organization will be set when they access their account page
      cmsUtils.ensureUserHasOrganization(data.user.id).catch(err => {
        console.error('[LOGIN] Failed to ensure user organization:', err);
      });
    }
    
    // Set status and headers from auth response
    response.status(authResponse.status);
    authResponse.headers.forEach((value, key) => {
      response.set(key, value);
    });
    response.send(text);
  } catch(error) {
    console.error('[LOGIN] Exception caught:', error);
    console.error('[LOGIN] Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack
    });
    // Return the actual status code if available, otherwise 500
    const statusCode = error.statusCode || 500;
    response.status(statusCode).json({ error: error.message || 'Internal server error' });
  }
};
