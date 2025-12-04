import { join } from 'path';
import { pathToFileURL } from 'url';
const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
const { auth } = authModule;

export default async (request, response) => {
  try {
    const sessionData = await auth.api.getSession({ headers: request.headers });
    
    if(!sessionData || !sessionData.user) {
      return response.status(404).json({ error: 'No session found' });
    }
    
    response.json(sessionData);
  } catch(error) {
    console.log('Session API error:', error);
    response.status(500).json({ error: error.message });
  }
};
