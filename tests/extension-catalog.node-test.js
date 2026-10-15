import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  The extension catalogue client: what it serves, from where, and what it refuses to believe. The
  network is a function that is passed in, so nothing here reaches extensions.kempo.dev.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { getCatalog, normalizeCatalog } = await import(pathToFileURL(path.join(root, 'server/utils/extensions/catalog.js')).href);
const { default: installPackage } = await import(pathToFileURL(path.join(root, 'server/utils/extensions/installPackage.js')).href);

const CATALOG_URL = 'https://extensions.test/api/v1/extensions.json';
const seed = [{ name: 'kempo-blog', description: 'A blog', author: 'Dustin' }];

const body = (extensions, version = 1) => JSON.stringify({ version, generatedAt: '2026-10-15T00:00:00Z', extensions });
const entry = (name, extra = {}) => ({ name, description: `${name} extension`, version: '1.0.0', installable: true, ...extra });

const reply = (status, text, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: key => headers[key.toLowerCase()] ?? null },
  text: async () => text,
});

/* A network that answers from a queue and remembers what it was asked. */
const network = (...answers) => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, headers: options?.headers || {} });
    const next = answers.shift();
    if(next instanceof Error) throw next;
    return next;
  };
  return { fetchImpl, calls };
};

const withCache = async work => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kempo-catalog-'));
  try {
    return await work(path.join(dir, 'catalog.json'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

export default {
  'a fetch is cached, and served from the cache until it is five minutes old': async ({ pass, fail }) => {
    await withCache(async cacheFile => {
      let clock = 1000000;
      const net = network(reply(200, body([entry('kempo-files')]), { etag: '"v1"' }));
      const options = { url: CATALOG_URL, cacheFile, seed, fetchImpl: net.fetchImpl, now: () => clock };

      const [, first] = await getCatalog(options);
      if(first.from !== 'network' || first.extensions[0]?.name !== 'kempo-files') return fail(`first: ${first.from}`);

      clock += 60 * 1000;
      const [, second] = await getCatalog(options);
      if(second.from !== 'fresh' || net.calls.length !== 1) return fail(`second: ${second.from}, ${net.calls.length} fetches`);
      pass('');
    });
  },

  'an expired cache is revalidated with its ETag, and a 304 keeps it': async ({ pass, fail }) => {
    await withCache(async cacheFile => {
      let clock = 1000000;
      const net = network(reply(200, body([entry('kempo-files')]), { etag: '"v1"' }), reply(304, ''));
      const options = { url: CATALOG_URL, cacheFile, seed, fetchImpl: net.fetchImpl, now: () => clock };

      await getCatalog(options);
      clock += 10 * 60 * 1000;
      const [, again] = await getCatalog(options);

      if(net.calls[1].headers['if-none-match'] !== '"v1"') return fail('the stored ETag was not sent');
      if(again.from !== 'network' || again.extensions[0]?.name !== 'kempo-files' || again.problem) return fail(`again: ${JSON.stringify(again)}`);
      pass('');
    });
  },

  'when the catalogue cannot be reached the last good copy is served and the problem is reported': async ({ pass, fail }) => {
    await withCache(async cacheFile => {
      let clock = 1000000;
      const net = network(reply(200, body([entry('kempo-files')])), new Error('connect ECONNREFUSED'));
      const options = { url: CATALOG_URL, cacheFile, seed, fetchImpl: net.fetchImpl, now: () => clock };

      await getCatalog(options);
      clock += 3600 * 1000;
      const [, later] = await getCatalog(options);

      if(later.from !== 'stale' || later.extensions[0]?.name !== 'kempo-files') return fail(`later: ${later.from}`);
      if(!/ECONNREFUSED/.test(later.problem || '')) return fail(`problem: ${later.problem}`);
      pass('');
    });
  },

  'a site that has never reached the catalogue gets the built-in list, and an empty CATALOG_URL turns it off': async ({ pass, fail }) => {
    await withCache(async cacheFile => {
      const net = network(reply(500, 'Server Error'));
      const [, offline] = await getCatalog({ url: CATALOG_URL, cacheFile, seed, fetchImpl: net.fetchImpl });
      if(offline.from !== 'seed' || offline.extensions[0]?.name !== 'kempo-blog' || !offline.problem) return fail(`offline: ${JSON.stringify(offline)}`);

      const silent = network();
      const [, disabled] = await getCatalog({ url: '', cacheFile, seed, fetchImpl: silent.fetchImpl });
      if(disabled.from !== 'seed' || disabled.problem || silent.calls.length) return fail(`disabled: ${JSON.stringify(disabled)}`);

      const [, notHttp] = await getCatalog({ url: 'file:///etc/passwd', cacheFile, seed, fetchImpl: silent.fetchImpl });
      if(!notHttp.problem || silent.calls.length) return fail('a non-http CATALOG_URL was fetched');
      pass('');
    });
  },

  'a cache from another catalogue CATALOG_URL is not used': async ({ pass, fail }) => {
    await withCache(async cacheFile => {
      const net = network(reply(200, body([entry('from-first')])), reply(200, body([entry('from-second')])));
      await getCatalog({ url: CATALOG_URL, cacheFile, seed, fetchImpl: net.fetchImpl });
      const [, second] = await getCatalog({ url: `${CATALOG_URL}?other`, cacheFile, seed, fetchImpl: net.fetchImpl });
      if(second.extensions[0]?.name !== 'from-second') return fail(`second: ${second.extensions[0]?.name}`);
      pass('');
    });
  },

  'what the remote sends is checked, not trusted': async ({ pass, fail }) => {
    const catalog = normalizeCatalog(JSON.parse(body([
      entry('good', { homepage: 'javascript:alert(1)', origin: { type: 'repository', url: 'https://github.com/a/b' }, evil: '<script>', requires: { extensions: ['kempo-files', '../etc', 7] } }),
      entry('../escape'),
      entry('Has Spaces'),
      { description: 'no name' },
      null,
      'a string',
      entry('big', { readme: 'x'.repeat(300 * 1024) }),
    ])));
    const names = catalog.extensions.map(item => item.name);
    if(names.join() !== 'good,big') return fail(`kept: ${names.join()}`);
    const [good, big] = catalog.extensions;
    if(good.homepage !== '') return fail(`homepage: ${good.homepage}`);
    if(good.origin.url !== 'https://github.com/a/b') return fail('a https link was dropped');
    if('evil' in good) return fail('an unknown field was kept');
    if(good.requires.extensions.join() !== 'kempo-files') return fail(`requires: ${good.requires.extensions}`);
    if(big.readme.length > 200 * 1024) return fail('the README was not capped');

    if(normalizeCatalog(JSON.parse(body([entry('x')], 2))) !== null) return fail('an unknown catalogue version was accepted');
    if(normalizeCatalog({ version: 1, extensions: 'nope' }) !== null) return fail('a non-list was accepted');
    pass('');
  },

  'a response that is not a catalogue never replaces a good cache': async ({ pass, fail }) => {
    await withCache(async cacheFile => {
      let clock = 1000000;
      const net = network(reply(200, body([entry('kempo-files')])), reply(200, '<html>captive portal</html>'));
      const options = { url: CATALOG_URL, cacheFile, seed, fetchImpl: net.fetchImpl, now: () => clock };

      await getCatalog(options);
      clock += 3600 * 1000;
      const [, later] = await getCatalog(options);
      const stored = JSON.parse(await readFile(cacheFile, 'utf8'));

      if(later.from !== 'stale' || later.extensions[0]?.name !== 'kempo-files') return fail(`later: ${later.from}`);
      if(stored.catalog.extensions[0]?.name !== 'kempo-files') return fail('the cache was overwritten');
      pass('');
    });
  },

  'simultaneous requests share one fetch': async ({ pass, fail }) => {
    await withCache(async cacheFile => {
      const net = network(reply(200, body([entry('kempo-files')])));
      const results = await Promise.all([1, 2, 3, 4].map(() => getCatalog({ url: CATALOG_URL, cacheFile, seed, fetchImpl: net.fetchImpl })));
      if(net.calls.length !== 1) return fail(`${net.calls.length} fetches`);
      if(results.some(([, result]) => result.extensions[0]?.name !== 'kempo-files')) return fail('a caller got a different answer');
      pass('');
    });
  },

  'a package name or version that could be a shell command is refused before npm runs': async ({ pass, fail }) => {
    const bad = [
      { name: 'kempo-files; echo pwned' },
      { name: '../../etc/passwd' },
      { name: 'a b' },
      { name: '' },
      { name: 'kempo-files', version: '1.0.0 && echo pwned' },
      { name: 'kempo-files', version: '$(whoami)' },
    ];
    for(const input of bad){
      const [error] = await installPackage(input);
      if(error?.code !== 400) return fail(`${JSON.stringify(input)} was not refused: ${JSON.stringify(error)}`);
    }
    pass('');
  },
};
