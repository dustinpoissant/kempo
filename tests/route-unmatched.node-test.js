import { writeFile, mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq } from 'drizzle-orm';

/*
  Covers the `route:unmatched` draft chain that answers requests nothing else claimed.

  The contract worth protecting here is not "a handler can serve a response" but everything around
  it: that every handler runs even once one has claimed the request, that they run in registration
  order, that a handler throwing cannot take the site's 404 down with it, and that a handler
  pointing at a file gets it streamed through kempo-server (so a gated download keeps Range
  support) rather than buffered by hand.

  Requires a reachable Postgres with kempo's schema applied (`npx drizzle-kit push`). When the
  database cannot be reached the suite reports itself as skipped rather than failing, matching
  extension-lifecycle.node-test.js, so a checkout without one still runs `npm test` cleanly.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(root, 'tests', 'fixtures', 'route-unmatched-handlers');
const OWNER = 'route-unmatched-fixture';

const db = (await import(pathToFileURL(path.join(root, 'server/db/index.js')).href)).default;
const { hook } = await import(pathToFileURL(path.join(root, 'server/db/schema.js')).href);
const serveUnmatched = (await import(pathToFileURL(path.join(root, 'server/utils/routing/serveUnmatched.js')).href)).default;
const { clearHandlerCache } = await import(pathToFileURL(path.join(root, 'server/utils/hooks/triggerHook.js')).href);

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const skipped = reason => ({
  'route:unmatched (SKIPPED)': async ({ pass }) => pass(`skipped: ${reason}`),
});

const purge = () => db.delete(hook).where(eq(hook.owner, OWNER)).catch(() => {});

/*
  createdAt drives handler order, so the fixtures are registered with explicit, spaced timestamps
  rather than whatever the clock happens to produce inside one millisecond.
*/
const register = async (file, minutesOffset) => {
  await db.insert(hook).values({
    id: `${OWNER}-${file}-${minutesOffset}`,
    owner: OWNER,
    event: 'route:unmatched',
    callback: path.join(FIXTURES, file),
    createdAt: new Date(Date.UTC(2020, 0, 1, 0, minutesOffset)),
  });
  clearHandlerCache();
};

const mockReq = (url, headers = {}) => ({ url, method: 'GET', headers });

const mockRes = () => {
  const headers = {};
  const chunks = [];
  return {
    statusCode: null,
    writeHead(code, hdrs = {}){ this.statusCode = code; Object.assign(headers, hdrs); },
    write(chunk){ if(chunk) chunks.push(Buffer.from(chunk)); return true; },
    end(chunk){ if(chunk) chunks.push(Buffer.from(chunk)); },
    getHeader: k => headers[k],
    getBody: () => Buffer.concat(chunks).toString('utf8'),
  };
};

const tests = {
  'every handler runs, in registration order, even after one claims the request': async ({ pass, fail }) => {
    try {
      await purge();
      await register('claims-with-body.js', 0);
      await register('observes-after.js', 1);

      const res = mockRes();
      await serveUnmatched(mockReq('/claimed-by-fixture'), res, path.join(root, 'app-public'));

      if(res.statusCode !== 200) return fail(`expected the claiming handler's 200, got ${res.statusCode}`);
      if(res.getBody() !== 'claimed') return fail(`expected the claimed body, got "${res.getBody()}"`);
      /*
        The second handler ran (header present) and saw the first one's decision (value "true") —
        which is the whole point of not stopping at the first responder.
      */
      if(res.getHeader('X-Observed-Handled') !== 'true'){
        return fail('the later handler either did not run or could not see that the request was already handled');
      }
      pass('all handlers run in order');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a handler that throws does not stop the others or the 404': async ({ pass, fail }) => {
    try {
      await purge();
      await register('throws.js', 0);
      await register('observes-after.js', 1);

      const res = mockRes();
      await serveUnmatched(mockReq('/nothing-claims-this'), res, path.join(root, 'app-public'));

      if(res.statusCode !== 404) return fail(`expected the default 404, got ${res.statusCode}`);
      if(res.getHeader('X-Observed-Handled') !== 'false'){
        return fail('the handler after the throwing one should still have run');
      }
      pass('throwing handler absorbed');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'an unclaimed request renders the site 404 page': async ({ pass, fail }) => {
    try {
      await purge();
      const res = mockRes();
      await serveUnmatched(mockReq('/definitely/not/a/page'), res, path.join(root, 'app-public'));

      if(res.statusCode !== 404) return fail(`expected 404, got ${res.statusCode}`);
      if(!res.getHeader('Content-Type')?.startsWith('text/html')) return fail('404 should be HTML');
      if(!res.getBody().includes('404')) return fail('should have rendered CATCH.page.html');
      pass('default 404 renders');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a handler pointing at a file gets it streamed with its own headers and Range support': async ({ pass, fail }) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'kempo-unmatched-'));
    try {
      await purge();
      const target = path.join(dir, 'gated.js');
      await writeFile(target, 'alert("gated")');
      process.env.KEMPO_TEST_FIXTURE_FILE = target;
      await register('claims-with-file.js', 0);

      const res = mockRes();
      await serveUnmatched(mockReq('/claimed-by-file'), res, path.join(root, 'app-public'));

      if(res.statusCode !== 200) return fail(`expected 200, got ${res.statusCode}`);
      if(res.getBody() !== 'alert("gated")') return fail(`wrong content: ${res.getBody()}`);
      /*
        The headers the handler chose have to survive — serving a .js file as text/plain with
        nosniff is exactly how an untrusted upload is made viewable without being executable.
      */
      if(res.getHeader('Content-Type') !== 'text/plain') return fail(`expected the handler's content type, got ${res.getHeader('Content-Type')}`);
      if(res.getHeader('X-Content-Type-Options') !== 'nosniff') return fail('handler headers should survive');
      if(res.getHeader('Accept-Ranges') !== 'bytes') return fail('a streamed file should advertise range support');
      pass('file streamed with handler headers');
    } catch(e){ fail(e.message); } finally {
      delete process.env.KEMPO_TEST_FIXTURE_FILE;
      await purge();
      await rm(dir, { recursive: true, force: true });
    }
  },

  'a range request against a handler-served file returns 206': async ({ pass, fail }) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'kempo-unmatched-'));
    try {
      await purge();
      const target = path.join(dir, 'gated.js');
      await writeFile(target, '0123456789');
      process.env.KEMPO_TEST_FIXTURE_FILE = target;
      await register('claims-with-file.js', 0);

      const res = mockRes();
      await serveUnmatched(mockReq('/claimed-by-file', { range: 'bytes=2-4' }), res, path.join(root, 'app-public'));

      if(res.statusCode !== 206) return fail(`expected 206, got ${res.statusCode}`);
      if(res.getBody() !== '234') return fail(`wrong slice: ${res.getBody()}`);
      if(res.getHeader('Content-Range') !== 'bytes 2-4/10') return fail(`wrong Content-Range: ${res.getHeader('Content-Range')}`);
      pass('range honored through the hook');
    } catch(e){ fail(e.message); } finally {
      delete process.env.KEMPO_TEST_FIXTURE_FILE;
      await purge();
      await rm(dir, { recursive: true, force: true });
    }
  },
};

export default databaseReachable ? tests : skipped('no reachable database');
