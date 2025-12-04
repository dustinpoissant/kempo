import { join } from 'path';
import { pathToFileURL } from 'url';
import { readFile } from 'fs/promises';

export default async (request, response) => {
  try {
    const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
    const { auth } = authModule;

    const session = await auth.api.getSession({ headers: request.headers });
    
    if(!session || !session.user) {
      return response.redirect('/account/login');
    }

    const html = await readFile(join(process.cwd(), 'templates', 'account', 'account.html'), 'utf-8');
    response.html(html);
  } catch(error) {
    console.error('Account dashboard error:', error);
    response.redirect('/account/login');
  }
};
