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

    const body = await request.json();
    
    const result = await auth.api.removeMember({
      headers: request.headers,
      body: {
        memberIdOrEmail: body.memberIdOrEmail
      }
    });
    
    response.json(result);
  } catch(error) {
    console.error('Remove member error:', error);
    response.status(500).json({ error: error.message });
  }
};
