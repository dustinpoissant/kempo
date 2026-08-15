import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { renderExternalPage } from 'kempo-server/templating';

/*
  The last stop for any request nothing else on the site claimed.

  kempo-server walks upward from the deepest directory a URL implies looking for a CATCH file, so
  this one — sitting at the site root — is reached for every unmatched URL, at any depth, with no
  prefix or configuration involved. It fires the `route:unmatched` hook, which is how an extension
  answers a request for something that has no file behind it (a gated download, a short link, a
  generated feed), and otherwise renders CATCH.page.html as the site's 404.

  This file takes priority over CATCH.page.html, which is kept as the page shown when no handler
  claims the request — so the 404 page stays editable as an ordinary page.

  Everything real lives in kempo so it can be fixed by upgrading rather than by editing this file.
*/

const PUBLIC_DIR = dirname(fileURLToPath(import.meta.url));

/*
  Resolved once, at load, and deliberately outside the request handler: a failure to *find* kempo
  falls back to serving the 404 page directly, while a failure *inside* the dispatcher still
  propagates as a normal error rather than being swallowed and double-answered.

  The fallback matters because this file owns every 404 on the site. If it could throw, a site
  whose install is halfway through an upgrade would answer 500 for every unmatched URL instead of
  showing its own 404 page — a much worse failure than losing the hook.
*/
let serveUnmatched = null;
try {
  ({ default: serveUnmatched } = await import('kempo/server/utils/routing/serveUnmatched.js'));
} catch {
  console.warn('[kempo] Could not load the route:unmatched dispatcher; serving the 404 page directly. Is kempo installed?');
}

export default async (request, response) => {
  if(serveUnmatched) return serveUnmatched(request, response, PUBLIC_DIR);

  const url = request.url.split('?')[0];
  let resolveDir = PUBLIC_DIR;
  for(const part of url.replace(/\/+$/, '').split('/').filter(Boolean)) resolveDir = join(resolveDir, part);

  try {
    const html = await renderExternalPage(join(PUBLIC_DIR, 'CATCH.page.html'), PUBLIC_DIR, resolveDir);
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
};
