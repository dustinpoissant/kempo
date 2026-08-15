import { join } from 'path';
import { renderExternalPage } from 'kempo-server/templating';
import triggerHook from '../hooks/triggerHook.js';

/*
  Imported only when a handler actually serves a file. `kempo-server/serve-static-file` is a newer
  export than kempo's minimum peer version, and loading it eagerly would make this whole module —
  and so every 404 on the site — fail to load against an older kempo-server, for the sake of a
  branch most sites never reach.
*/
const loadStaticFileServer = async () => {
  try {
    return (await import('kempo-server/serve-static-file')).default;
  } catch {
    throw new Error(
      'A route:unmatched handler set draft.filePath, which needs kempo-server >= 3.3.0. Upgrade kempo-server, or have the handler set draft.body instead.'
    );
  }
};

/*
  Answers a request nothing else claimed. Driven by the site's public/CATCH.js, which is reached for
  every unmatched URL on the site at any depth — kempo-server walks upward from the deepest
  directory a URL implies looking for a CATCH file, so the one at the site root is the final
  fallback, with no prefix or configuration involved.

  That makes this the one place an extension can answer a request for something with no file behind
  it: a download served out of a directory the static scanner deliberately cannot see, a short
  link, a generated feed.

  Rather than hand each handler the live response, the `route:unmatched` hook carries a **draft**
  that handlers fill in, and the single real write happens here once they have all run. Nothing is
  sent mid-chain, so a handler cannot end the request early and silence the ones after it — an
  extension that logs every 404 still sees requests another extension answered. Handlers run in
  registration order and each can see what earlier ones decided via `draft.handled`, so they can
  defer to each other, or add to a response already in progress.

  Anything slow belongs in a background task rather than awaited in a handler: this runs on every
  unmatched request, and the response waits on it.
*/
export default async (request, response, publicDir) => {
  const url = request.url.split('?')[0];

  const draft = {
    status: null,
    headers: {},
    body: null,
    filePath: null,
    handled: false,
  };

  /*
    Deliberately not a bailing hook: one extension throwing must not take the site's 404 page down
    with it, nor stop the handlers registered after it. triggerHook records the error and continues.
  */
  await triggerHook('route:unmatched', {
    url,
    method: request.method,
    request,
    draft,
  });

  /*
    A file wins over an inline body: it is the only one of the two that needs streaming, and
    serveStaticFile is what gives it Range/206 support, so a gated video still seeks. The handler
    only described what to serve — the bytes still go out through the same helper every static file
    on the site uses.
  */
  if(draft.filePath){
    const serveStaticFile = await loadStaticFileServer();
    const { 'Content-Type': contentType, ...rest } = draft.headers;
    await serveStaticFile(draft.filePath, request, response, {}, undefined, { contentType, headers: rest });
    return;
  }

  if(draft.body !== null){
    response.writeHead(draft.status || 200, draft.headers);
    response.end(draft.body);
    return;
  }

  /*
    `handled` with neither body nor file means a handler wrote a status and nothing else — a
    redirect, say, or a bare 204.
  */
  if(draft.handled){
    response.writeHead(draft.status || 204, draft.headers);
    response.end();
    return;
  }

  /*
    resolveDir is built from the request URL rather than from where the CATCH file lives, so
    {{pathToRoot}} in the 404 page points back up from the depth the visitor actually asked for.
  */
  let resolveDir = publicDir;
  for(const part of url.replace(/\/+$/, '').split('/').filter(Boolean)) resolveDir = join(resolveDir, part);

  /*
    Handlers that added headers without claiming the request keep them here — a handler annotating
    every response (a request id, a cache directive) should not have its work thrown away just
    because nothing served a body. The content type is applied last so it cannot be clobbered.
  */
  try {
    const html = await renderExternalPage(join(publicDir, 'CATCH.page.html'), publicDir, resolveDir);
    response.writeHead(404, { ...draft.headers, 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
  } catch {
    // CATCH.page.html was deleted or fails to render — still answer, rather than hanging the request
    response.writeHead(404, { ...draft.headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
};
