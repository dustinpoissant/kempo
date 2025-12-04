import { join } from 'path';
import { pathToFileURL } from 'url';
import { readFile } from 'fs/promises';

export default async (request, response) => {
  try {
    const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
    const { auth } = authModule;

    const session = await auth.api.getSession({ headers: request.headers });
    const isLoggedIn = session && session.user;
    const page = request.params.page;

    if(page === 'login') {
      if(isLoggedIn) {
        return response.redirect('/account');
      }
      const html = await readFile(join(process.cwd(), 'templates', 'account', 'login.html'), 'utf-8');
      return response.html(html);
    }

    if(page === 'register') {
      if(isLoggedIn) {
        return response.redirect('/account');
      }
      const html = await readFile(join(process.cwd(), 'templates', 'account', 'register.html'), 'utf-8');
      return response.html(html);
    }

    if(page === 'forgot-password') {
      if(isLoggedIn) {
        return response.redirect('/account');
      }
      const html = await readFile(join(process.cwd(), 'templates', 'account', 'forgot-password.html'), 'utf-8');
      return response.html(html);
    }

    response.status(404).send('Not Found');
  } catch(error) {
    console.error('Account route error:', error);
    response.status(500).send('Internal Server Error');
  }
};