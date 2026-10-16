/*
  The extension marketplace (https://kempo.dev), as this site's SERVER sees it. The browser
  only ever talks to this site's own API, which calls this.

    list      a page of cards: search, sort, limit, offset
    details   everything about one extension, with its full dependency tree
    report    tell the marketplace this site installed an extension (counted once per site)
    rate      this site's rating of an extension

  Reads are cached in memory for `ttlMs`, and an older copy is served when the marketplace cannot be
  reached (marked `stale`). Concurrent identical reads share one request. Nothing is ever executed
  from a response, and only known fields are kept, with their types and sizes checked, links limited to
  http(s), and the response size capped.

  Every function returns [error, data] and never throws.
*/

export const DEFAULT_CATALOG_URL = 'https://kempo.dev/api/v1';

export const NAME_PATTERN = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_README = 200 * 1024;
const MAX_CACHED = 200;

const text = (value, max = 1000) => typeof value === 'string' ? value.slice(0, max) : '';

const link = value => /^https?:\/\//i.test(text(value, 2000)) ? text(value, 2000) : '';

const count = value => Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

const names = value => (Array.isArray(value) ? value : []).filter(item => typeof item === 'string' && NAME_PATTERN.test(item));

const described = (list, fields) => (Array.isArray(list) ? list : [])
  .filter(item => item && typeof item === 'object' && typeof item[fields[0]] === 'string')
  .slice(0, 200)
  .map(item => Object.fromEntries(fields.map(field => [field, text(item[field], 500)])));

const rating = value => ({
  average: Number.isFinite(value?.average) ? Math.min(5, Math.max(0, value.average)) : null,
  count: count(value?.count),
});

/* A card in a list. */
export const normalizeCard = raw => {
  if(!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !NAME_PATTERN.test(raw.name)) return null;
  return {
    name: raw.name,
    description: text(raw.description, 2000),
    author: text(raw.author, 200),
    version: text(raw.version, 100),
    installable: raw.installable !== false,
    installs: count(raw.installs),
    rating: rating(raw.rating),
    source: text(raw.source, 50) || 'catalogue',
    pricing: { type: text(raw.pricing?.type, 50) || 'free' },
  };
};

/* One extension in full. */
export const normalizeDetails = raw => {
  const card = normalizeCard(raw);
  if(!card) return null;
  return {
    ...card,
    license: text(raw.license, 100),
    homepage: link(raw.homepage),
    origin: { type: raw.origin?.type === 'npm' ? 'npm' : 'repository', url: link(raw.origin?.url) },
    keywords: (Array.isArray(raw.keywords) ? raw.keywords : []).filter(item => typeof item === 'string').slice(0, 20).map(item => item.slice(0, 50)),
    requires: { kempo: text(raw.requires?.kempo, 100), extensions: names(raw.requires?.extensions) },
    provides: {
      publicScope: text(raw.provides?.publicScope, 100),
      permissions: described(raw.provides?.permissions, ['name', 'description']),
      settings: described(raw.provides?.settings, ['name', 'type', 'description']),
      groups: described(raw.provides?.groups, ['name', 'description']),
      widgets: described(raw.provides?.widgets, ['key', 'title', 'description']),
    },
    npmDependencies: Object.fromEntries(Object.entries(raw.npmDependencies && typeof raw.npmDependencies === 'object' ? raw.npmDependencies : {})
      .filter(([key, range]) => typeof range === 'string').slice(0, 100).map(([key, range]) => [key.slice(0, 214), range.slice(0, 100)])),
    readme: typeof raw.readme === 'string' ? raw.readme.slice(0, MAX_README) : null,
    stale: raw.stale === true,
    dependencies: {
      /* Dependencies first: the order to install them in. */
      extensions: (Array.isArray(raw.dependencies?.extensions) ? raw.dependencies.extensions : [])
        .filter(item => item && typeof item.name === 'string' && NAME_PATTERN.test(item.name))
        .slice(0, 100)
        .map(item => ({
          name: item.name,
          description: text(item.description, 2000),
          version: text(item.version, 100),
          installable: item.installable !== false,
          requires: names(item.requires),
        })),
      unresolved: names(raw.dependencies?.unresolved),
    },
  };
};

export const normalizePage = raw => {
  if(!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null;
  return {
    total: count(raw.total),
    limit: count(raw.limit),
    offset: count(raw.offset),
    items: raw.items.map(normalizeCard).filter(Boolean),
  };
};

const encodeName = name => encodeURIComponent(name);

/*
  A client for one marketplace address. Pass `baseUrl: ''` for none: every call then answers 503, which
  is how a site turns the marketplace off.
*/
export const createCatalogClient = ({ baseUrl = DEFAULT_CATALOG_URL, fetchImpl = fetch, ttlMs = 5 * 60 * 1000, timeoutMs = 8000, now = Date.now } = {}) => {
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  const cache = new Map();
  const inflight = new Map();

  const unavailable = () => [{ code: 503, msg: base ? 'The extension marketplace is not reachable' : 'The extension marketplace is turned off for this site' }, null];

  const request = async (method, path, body) => {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = await response.text();
    if(raw.length > MAX_BYTES) throw new Error('the response is too large');
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error('the response is not JSON');
    }
    return { status: response.status, ok: response.ok, data };
  };

  const fail = (response, fallback) => [{ code: response.status >= 400 && response.status < 600 ? response.status : 502, msg: text(response.data?.error, 300) || fallback }, null];

  /* A cached read: fresh from memory, else fetched, else the older copy, else an error. */
  const read = async (path, normalize, pick = data => data) => {
    if(!base) return unavailable();

    const cached = cache.get(path);
    if(cached && now() - cached.at < ttlMs) return [null, cached.value];

    if(!inflight.has(path)){
      inflight.set(path, (async () => {
        try {
          const response = await request('GET', path);
          if(!response.ok) return fail(response, `The marketplace answered ${response.status}`);
          const value = normalize(pick(response.data));
          if(!value) return [{ code: 502, msg: 'The marketplace sent something that is not understood' }, null];
          if(cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value);
          cache.set(path, { value, at: now() });
          return [null, value];
        } catch(error) {
          if(cached) return [null, { ...cached.value, stale: true }];
          return [{ code: 503, msg: `The extension marketplace could not be reached: ${error.message}` }, null];
        } finally {
          inflight.delete(path);
        }
      })());
    }
    return inflight.get(path);
  };

  const write = async (method, path, body) => {
    if(!base) return unavailable();
    try {
      const response = await request(method, path, body);
      if(!response.ok) return fail(response, `The marketplace answered ${response.status}`);
      /* Counts and averages just changed, so what is held in memory is out of date. */
      if(method !== 'GET') cache.clear();
      return [null, response.data];
    } catch(error) {
      return [{ code: 503, msg: `The extension marketplace could not be reached: ${error.message}` }, null];
    }
  };

  return {
    list: ({ search, sort, limit, offset } = {}) => {
      const query = new URLSearchParams();
      if(search) query.set('search', String(search).slice(0, 100));
      if(sort) query.set('sort', String(sort));
      if(limit) query.set('limit', String(limit));
      if(offset) query.set('offset', String(offset));
      return read(`/extensions${query.size ? `?${query}` : ''}`, normalizePage);
    },

    details: name => NAME_PATTERN.test(name || '')
      ? read(`/extensions/${encodeName(name)}`, normalizeDetails, data => data?.extension)
      : Promise.resolve([{ code: 400, msg: 'Extension name is not a valid package name' }, null]),

    report: ({ installId, extension }) => write('POST', `/extensions/${encodeName(extension)}/installs`, { installId }),

    rate: ({ installId, extension, value }) => write('PUT', `/extensions/${encodeName(extension)}/rating`, { installId, rating: value }),

    siteRating: ({ installId, extension }) => write('GET', `/extensions/${encodeName(extension)}/rating?installId=${encodeURIComponent(installId)}`),
  };
};
