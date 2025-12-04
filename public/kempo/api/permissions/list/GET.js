import { join } from 'path';
import { pathToFileURL } from 'url';
import db from '../../../../../server/db/index.js';
import { permission } from '../../../../../server/db/schema.js';

export default async (request, response) => {
  try {
    const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
    const { auth } = authModule;

    const session = await auth.api.getSession({ headers: request.headers });
    
    if(!session || !session.user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const permissions = await db.select().from(permission);
    
    response.json({ permissions });
  } catch(error) {
    console.error('List permissions error:', error);
    response.status(500).json({ error: error.message });
  }
};
