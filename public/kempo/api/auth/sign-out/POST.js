import { join } from 'path';
import { pathToFileURL } from 'url';
const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
const { auth } = authModule;

export default async (request, response) => {
  try {
    const authRequest = new Request(`${auth.options.baseURL}/api/auth/sign-out`, {
      method: 'POST',
      headers: request.headers,
    });

    const authResponse = await auth.handler(authRequest);
    const text = await authResponse.text();
    
    response.status(authResponse.status);
    authResponse.headers.forEach((value, key) => {
      response.set(key, value);
    });
    response.send(text);
  } catch(error) {
    response.status(500).json({ error: error.message });
  }
};
