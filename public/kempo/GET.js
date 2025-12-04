import { join } from 'path';
import { pathToFileURL } from 'url';
import { readFile } from 'fs/promises';

export default async (request, response) => {
  try {
    const authModule = await import(pathToFileURL(join(process.cwd(), 'server', 'auth.js')).href);
    const { auth } = authModule;
    const cmsUtils = await import(pathToFileURL(join(process.cwd(), 'server', 'cms-utils.js')).href);

    const session = await auth.api.getSession({ headers: request.headers });
    
    if(!session || !session.user) {
      return response.redirect('/account/login');
    }

    await cmsUtils.ensureUserHasOrganization(session.user.id);

    const org = await cmsUtils.getOrCreateDefaultOrganization();
    await auth.api.setActiveOrganization({
      body: {
        organizationId: org.id
      },
      headers: request.headers
    });

    const hasAccess = await cmsUtils.checkPermission(request, 'content', ['read']);

    if(!hasAccess) {
      return response.redirect('/account');
    }

    const html = await readFile(join(process.cwd(), 'templates', 'kempo', 'index.html'), 'utf-8');
    response.html(html);
  } catch(error) {
    console.error('Admin panel error:', error);
    response.redirect('/account/login');
  }
};
