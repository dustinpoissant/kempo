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

    const { limit, offset } = request.query;
    
    const result = await auth.api.listMembers({
      headers: request.headers,
      query: {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      }
    });
    
    response.json(result);
  } catch(error) {
    console.error('List members error:', error);
    response.status(500).json({ error: error.message });
  }
};
