import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  The marketplace client and the install-with-dependencies flow. The network, npm and the database are
  all passed in, so nothing here reaches extensions.kempo.dev or installs anything.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const { createCatalogClient, normalizeDetails, normalizePage } = await load('server/utils/extensions/catalogClient.js');
const { default: installFromCatalog } = await load('server/utils/extensions/installFromCatalog.js');
const { default: installPackage } = await load('server/utils/extensions/installPackage.js');

const BASE = 'https://market.test/api/v1';

const reply = (status, data) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => typeof data === 'string' ? data : JSON.stringify(data),
});

/* A network that answers by URL (falling back to the last registered answer) and logs requests. */
const network = answers => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    const answer = answers[url] ?? answers['*'];
    if(answer instanceof Error) throw answer;
    return typeof answer === 'function' ? answer(url, options) : answer;
  };
  return { fetchImpl, calls };
};

const card = (name, extra = {}) => ({ name, description: `${name} extension`, version: '1.0.0', installable: true, installs: 3, rating: { average: 4.5, count: 2 }, ...extra });

const details = (name, dependencies = [], unresolved = [], extra = {}) => ({
  extension: {
    ...card(name),
    readme: `# ${name}`,
    requires: { extensions: dependencies.map(dependency => dependency.name) },
    dependencies: { extensions: dependencies.map(dependency => ({ ...card(dependency.name), requires: [], ...dependency })), unresolved },
    ...extra,
  },
});

export default {
  'a list is requested with its parameters, normalised, and served from memory for five minutes': async ({ pass, fail }) => {
    let clock = 1000000;
    const net = network({ '*': reply(200, { total: 1, limit: 24, offset: 0, items: [card('kempo-files'), { name: '../bad' }, null] }) });
    const client = createCatalogClient({ baseUrl: BASE, fetchImpl: net.fetchImpl, now: () => clock });

    const [error, page] = await client.list({ search: 'file', sort: 'rating', limit: 12, offset: 24 });
    if(error || page.items.length !== 1 || page.items[0].name !== 'kempo-files') return fail(`page: ${JSON.stringify(error || page)}`);
    if(net.calls[0].url !== `${BASE}/extensions?search=file&sort=rating&limit=12&offset=24`) return fail(`url: ${net.calls[0].url}`);

    clock += 60 * 1000;
    await client.list({ search: 'file', sort: 'rating', limit: 12, offset: 24 });
    if(net.calls.length !== 1) return fail(`a second call inside the TTL fetched again: ${net.calls.length}`);

    clock += 10 * 60 * 1000;
    await client.list({ search: 'file', sort: 'rating', limit: 12, offset: 24 });
    if(net.calls.length !== 2) return fail('an expired entry was not refetched');
    pass('');
  },

  'when the marketplace is down an older copy is served as stale, and with none there is an error': async ({ pass, fail }) => {
    let clock = 1000000;
    const answers = { '*': reply(200, details('kempo-files')) };
    const net = network(answers);
    const client = createCatalogClient({ baseUrl: BASE, fetchImpl: net.fetchImpl, now: () => clock });

    const [, first] = await client.details('kempo-files');
    if(first.readme !== '# kempo-files') return fail('details');

    answers['*'] = new Error('connect ECONNREFUSED');
    clock += 3600 * 1000;
    const [error, stale] = await client.details('kempo-files');
    if(error || stale.stale !== true || stale.name !== 'kempo-files') return fail(`stale: ${JSON.stringify(error || stale)}`);

    const [none] = await client.details('kempo-never-seen');
    if(none?.code !== 503 || !/ECONNREFUSED/.test(none.msg)) return fail(`none: ${JSON.stringify(none)}`);
    pass('');
  },

  'the marketplace turned off answers 503 without any request': async ({ pass, fail }) => {
    const net = network({});
    const client = createCatalogClient({ baseUrl: '', fetchImpl: net.fetchImpl });
    const [listError] = await client.list();
    const [detailsError] = await client.details('kempo-files');
    const [reportError] = await client.report({ installId: 'x', extension: 'kempo-files' });
    if(listError?.code !== 503 || detailsError?.code !== 503 || reportError?.code !== 503 || net.calls.length) return fail('off was not off');
    pass('');
  },

  'a marketplace error is passed on with its message, and a non-JSON answer is refused': async ({ pass, fail }) => {
    const net = network({ '*': reply(404, { error: '"nope" is not in the extension catalogue' }) });
    const client = createCatalogClient({ baseUrl: BASE, fetchImpl: net.fetchImpl });
    const [error] = await client.details('nope');
    if(error?.code !== 404 || !/not in the extension catalogue/.test(error.msg)) return fail(`404: ${JSON.stringify(error)}`);

    const html = createCatalogClient({ baseUrl: BASE, fetchImpl: network({ '*': reply(200, '<html>captive portal</html>') }).fetchImpl });
    const [htmlError] = await html.list();
    if(!htmlError || htmlError.code < 400) return fail(`html: ${JSON.stringify(htmlError)}`);

    const [badName] = await client.details('../../etc/passwd');
    if(badName?.code !== 400) return fail('a bad name was sent to the marketplace');
    pass('');
  },

  'what the marketplace sends is checked: names, links, sizes and unknown fields': async ({ pass, fail }) => {
    const normalized = normalizeDetails({
      ...details('kempo-media').extension,
      homepage: 'javascript:alert(1)',
      origin: { type: 'repository', url: 'https://github.com/a/b' },
      evil: '<script>',
      requires: { extensions: ['kempo-files', '../etc', 7] },
      readme: 'x'.repeat(300 * 1024),
      dependencies: { extensions: [{ name: 'kempo-files', version: '1.0.0' }, { name: 'Has Spaces' }, null], unresolved: ['ok-name', 'NOT ok'] },
    });
    if(normalized.homepage !== '') return fail(`homepage: ${normalized.homepage}`);
    if(normalized.origin.url !== 'https://github.com/a/b') return fail('a https link was dropped');
    if('evil' in normalized) return fail('an unknown field was kept');
    if(normalized.requires.extensions.join() !== 'kempo-files') return fail(`requires: ${normalized.requires.extensions}`);
    if(normalized.readme.length > 200 * 1024) return fail('README not capped');
    if(normalized.dependencies.extensions.length !== 1 || normalized.dependencies.unresolved.join() !== 'ok-name') return fail(`tree: ${JSON.stringify(normalized.dependencies)}`);
    if(normalizePage({ items: 'nope' }) !== null) return fail('a non-list page was accepted');
    pass('');
  },

  'an install is reported and a rating sent with the site id, as writes': async ({ pass, fail }) => {
    const net = network({ '*': reply(200, { ok: true }) });
    const client = createCatalogClient({ baseUrl: BASE, fetchImpl: net.fetchImpl });
    await client.report({ installId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', extension: 'kempo-files' });
    await client.rate({ installId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', extension: 'kempo-files', value: 4 });
    const [install, rate] = net.calls;
    if(install.method !== 'POST' || install.url !== `${BASE}/extensions/kempo-files/installs` || install.body.installId !== 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') return fail(`install: ${JSON.stringify(install)}`);
    if(rate.method !== 'PUT' || rate.body.rating !== 4) return fail(`rate: ${JSON.stringify(rate)}`);
    pass('');
  },

  'a write drops what is cached, so the counts it changed are read again': async ({ pass, fail }) => {
    const net = network({ '*': reply(200, details('kempo-files')) });
    const client = createCatalogClient({ baseUrl: BASE, fetchImpl: net.fetchImpl });
    await client.details('kempo-files');
    await client.details('kempo-files');
    if(net.calls.length !== 1) return fail('the second read was not cached');
    await client.report({ installId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', extension: 'kempo-files' });
    await client.details('kempo-files');
    if(net.calls.length !== 3) return fail(`calls after a write: ${net.calls.length}`);
    pass('');
  },

  'installing with dependencies installs the tree in order, downloading only what is missing': async ({ pass, fail }) => {
    const net = network({ '*': reply(200, details('kempo-media', [{ name: 'kempo-files' }, { name: 'kempo-thumbs' }])) });
    const client = createCatalogClient({ baseUrl: BASE, fetchImpl: net.fetchImpl });
    const log = [];
    const installedNow = new Set(['kempo-files']);
    const onDisk = new Set(['kempo-files']);

    const [error, result] = await installFromCatalog({
      name: 'kempo-media',
      withDependencies: true,
      client,
      installId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      deps: {
        isInstalled: async name => installedNow.has(name),
        isEnabled: async () => true,
        hasPackage: name => onDisk.has(name),
        download: async ({ name, version }) => { log.push(`download ${name}@${version}`); onDisk.add(name); return [null, {}]; },
        install: async ({ name }) => { log.push(`install ${name}`); installedNow.add(name); return [null, { name }]; },
      },
    });

    if(error) return fail(`error: ${JSON.stringify(error)}`);
    if(log.join() !== 'download kempo-thumbs@1.0.0,install kempo-thumbs,download kempo-media@1.0.0,install kempo-media') return fail(`order: ${log.join()}`);
    if(result.installed.join() !== 'kempo-thumbs,kempo-media') return fail(`installed: ${result.installed}`);
    await new Promise(resolve => setTimeout(resolve, 20));
    const reported = net.calls.filter(call => call.method === 'POST').map(call => call.url.split('/').slice(-2)[0]);
    if(reported.join() !== 'kempo-thumbs,kempo-media') return fail(`reported: ${reported}`);
    pass('');
  },

  'a requirement that is installed but switched off is enabled with the approved chain, never silently without it': async ({ pass, fail }) => {
    const net = network({ '*': reply(200, details('kempo-media', [{ name: 'kempo-files' }, { name: 'kempo-thumbs' }])) });
    const client = createCatalogClient({ baseUrl: BASE, fetchImpl: net.fetchImpl });
    const state = new Map([['kempo-files', false], ['kempo-thumbs', true]]);
    const log = [];
    const deps = {
      isInstalled: async name => state.has(name),
      isEnabled: async name => state.get(name) === true,
      hasPackage: () => true,
      download: async () => { log.push('download'); return [null, {}]; },
      enable: async ({ name }) => { log.push(`enable ${name}`); state.set(name, true); return [null, {}]; },
      install: async ({ name }) => { log.push(`install ${name}`); state.set(name, true); return [null, { name }]; },
    };

    const [refused] = await installFromCatalog({ name: 'kempo-media', client, deps });
    if(refused?.code !== 409 || refused.needs.join() !== 'kempo-files' || log.length) return fail(`without approval: ${JSON.stringify(refused)} ${log}`);

    const [error, result] = await installFromCatalog({ name: 'kempo-media', withDependencies: true, client, deps });
    if(error) return fail(`approved: ${JSON.stringify(error)}`);
    if(log.join() !== 'enable kempo-files,install kempo-media') return fail(`order: ${log.join()}`);
    if(result.enabled.join() !== 'kempo-files' || result.installed.join() !== 'kempo-media') return fail(`result: ${JSON.stringify(result)}`);
    pass('');
  },

  'without approval an extension whose dependencies are missing is not installed, and says which': async ({ pass, fail }) => {
    const net = network({ '*': reply(200, details('kempo-media', [{ name: 'kempo-files' }, { name: 'kempo-thumbs' }])) });
    const client = createCatalogClient({ baseUrl: BASE, fetchImpl: net.fetchImpl });
    const calls = [];

    const [error] = await installFromCatalog({
      name: 'kempo-media',
      client,
      deps: {
        isInstalled: async () => false,
        hasPackage: () => false,
        download: async () => { calls.push('download'); return [null, {}]; },
        install: async () => { calls.push('install'); return [null, {}]; },
      },
    });

    if(error?.code !== 409 || error.needs.join() !== 'kempo-files,kempo-thumbs') return fail(`error: ${JSON.stringify(error)}`);
    if(calls.length) return fail(`something ran: ${calls}`);
    pass('');
  },

  'an unlisted dependency, an unpublished extension and a download failure each stop it, and say what was done': async ({ pass, fail }) => {
    const base = { isInstalled: async () => false, hasPackage: () => false, install: async () => [null, {}] };

    const unresolved = network({ '*': reply(200, details('kempo-x', [], ['mystery'])) });
    const [unresolvedError] = await installFromCatalog({ name: 'kempo-x', withDependencies: true, client: createCatalogClient({ baseUrl: BASE, fetchImpl: unresolved.fetchImpl }), deps: { ...base, download: async () => [null, {}] } });
    if(unresolvedError?.code !== 409 || !/mystery/.test(unresolvedError.msg)) return fail(`unresolved: ${JSON.stringify(unresolvedError)}`);

    const unpublished = network({ '*': reply(200, details('kempo-x', [{ name: 'kempo-dep', installable: false }])) });
    const [unpublishedError] = await installFromCatalog({ name: 'kempo-x', withDependencies: true, client: createCatalogClient({ baseUrl: BASE, fetchImpl: unpublished.fetchImpl }), deps: { ...base, download: async () => [null, {}] } });
    if(unpublishedError?.code !== 409 || !/not published/.test(unpublishedError.msg)) return fail(`unpublished: ${JSON.stringify(unpublishedError)}`);

    const partial = network({ '*': reply(200, details('kempo-x', [{ name: 'kempo-dep' }])) });
    const [partialError] = await installFromCatalog({
      name: 'kempo-x',
      withDependencies: true,
      client: createCatalogClient({ baseUrl: BASE, fetchImpl: partial.fetchImpl }),
      deps: { ...base, download: async ({ name }) => name === 'kempo-x' ? [{ code: 500, msg: 'npm failed' }, null] : [null, {}] },
    });
    if(partialError?.code !== 500 || partialError.installed.join() !== 'kempo-dep') return fail(`partial: ${JSON.stringify(partialError)}`);
    pass('');
  },

  'with the marketplace down an extension already on disk installs as it always did, one that is not cannot': async ({ pass, fail }) => {
    const down = createCatalogClient({ baseUrl: BASE, fetchImpl: network({ '*': new Error('offline') }).fetchImpl });
    const installs = [];
    const deps = {
      isInstalled: async () => false,
      download: async () => { installs.push('download'); return [null, {}]; },
      install: async ({ name }) => { installs.push(`install ${name}`); return [null, { name }]; },
    };

    const [error] = await installFromCatalog({ name: 'kempo-files', client: down, deps: { ...deps, hasPackage: () => true } });
    if(error || installs.join() !== 'install kempo-files') return fail(`on disk: ${JSON.stringify(error)} ${installs}`);

    const [missing] = await installFromCatalog({ name: 'kempo-thumbs', client: down, deps: { ...deps, hasPackage: () => false } });
    if(missing?.code !== 503) return fail(`not on disk: ${JSON.stringify(missing)}`);
    pass('');
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
