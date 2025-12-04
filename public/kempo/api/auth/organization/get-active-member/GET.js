import { join } from 'path';
import { pathToFileURL } from 'url';

export default async (request, response) => {
  try {
    const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
    const { auth } = authModule;

    const session = await auth.api.getSession({ headers: request.headers });
    
    if(!session || !session.user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const result = await auth.api.getActiveMember({ headers: request.headers });
    
    response.json(result);
  } catch(error) {
    console.error('Get active member error:', error);
    response.status(500).json({ error: error.message });
  }
};
