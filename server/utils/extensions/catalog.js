import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname } from 'path';

/*
  The extension catalogue (https://extensions.kempo.dev), read by this site's SERVER and cached on
  disk. The browser only ever talks to this site's own API; it never reaches the catalogue.

  Where the answer comes from, in order:
    fresh      the cache file is younger than `ttlMs`
    network    fetched now (revalidated with the stored ETag when there is one)
    stale      the fetch failed, so the last good cache is used however old it is
    seed       nothing has ever been fetched: the short list that ships with kempo

  It never fails: the worst case is the seed list with a `problem` explaining why, so the Extensions
  page keeps working when the catalogue, or this server's route to it, is down.

  Whatever the remote sends is data, not trusted: only known fields are kept, with their types
  checked, links must be http(s), and the size is capped.
*/

export const DEFAULT_CATALOG_URL = 'https://extensions.kempo.dev/api/v1/extensions.json';

export const NAME_PATTERN = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const CATALOG_VERSION = 1;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_README = 200 * 1024;

const inflight = new Map();

const text = (value, max = 1000) => typeof value === 'string' ? value.slice(0, max) : '';

const link = value => /^https?:\/\//i.test(text(value, 2000)) ? text(value, 2000) : '';

const names = value => (Array.isArray(value) ? value : []).filter(item => typeof item === 'string' && NAME_PATTERN.test(item));

const described = (list, fields) => (Array.isArray(list) ? list : [])
  .filter(item => item && typeof item === 'object' && typeof item[fields[0]] === 'string')
  .slice(0, 200)
  .map(item => Object.fromEntries(fields.map(field => [field, text(item[field], 500)])));

export const normalizeEntry = raw => {
  if(!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !NAME_PATTERN.test(raw.name)) return null;
  return {
    name: raw.name,
    description: text(raw.description, 2000),
    author: text(raw.author, 200),
    license: text(raw.license, 100),
    version: text(raw.version, 100),
    installable: raw.installable !== false,
    homepage: link(raw.homepage),
    origin: { type: raw.origin?.type === 'npm' ? 'npm' : 'repository', url: link(raw.origin?.url) },
    requires: { kempo: text(raw.requires?.kempo, 100), extensions: names(raw.requires?.extensions) },
    provides: {
      publicScope: text(raw.provides?.publicScope, 100),
      permissions: described(raw.provides?.permissions, ['name', 'description']),
      settings: described(raw.provides?.settings, ['name', 'type', 'description']),
      groups: described(raw.provides?.groups, ['name', 'description']),
      widgets: described(raw.provides?.widgets, ['key', 'title', 'description']),
    },
    readme: typeof raw.readme === 'string' ? raw.readme.slice(0, MAX_README) : null,
    source: text(raw.source, 50) || 'catalogue',
    pricing: { type: text(raw.pricing?.type, 50) || 'free' },
    stale: raw.stale === true,
  };
};

export const normalizeCatalog = body => {
  if(!body || typeof body !== 'object' || body.version !== CATALOG_VERSION || !Array.isArray(body.extensions)) return null;
  return {
    generatedAt: text(body.generatedAt, 50),
    extensions: body.extensions.map(normalizeEntry).filter(Boolean),
  };
};

const readCache = async (cacheFile, url) => {
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
    if(cached.url !== url || !Array.isArray(cached.catalog?.extensions) || typeof cached.fetchedAt !== 'number') return null;
    return cached;
  } catch {
    return null;
  }
};

const writeCache = async (cacheFile, cached) => {
  try {
    await mkdir(dirname(cacheFile), { recursive: true });
    await writeFile(`${cacheFile}.tmp`, JSON.stringify(cached));
    await rename(`${cacheFile}.tmp`, cacheFile);
  } catch {
    /* A read-only disk costs the cache, not the answer. */
  }
};

const load = async ({ url, cacheFile, seed, ttlMs, timeoutMs, fetchImpl, now }) => {
  const fromSeed = problem => ({ extensions: seed.map(normalizeEntry).filter(Boolean).map(entry => ({ ...entry, source: 'seed' })), fetchedAt: null, from: 'seed', problem });

  if(!url) return fromSeed(null);
  if(!/^https?:\/\//i.test(url)) return fromSeed(`"${url}" is not an http(s) URL`);

  const cached = await readCache(cacheFile, url);
  if(cached && now() - cached.fetchedAt < ttlMs){
    return { extensions: cached.catalog.extensions, fetchedAt: cached.fetchedAt, from: 'fresh', problem: null };
  }

  try {
    const headers = { accept: 'application/json' };
    if(cached?.etag) headers['if-none-match'] = cached.etag;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers });

    if(response.status === 304 && cached){
      await writeCache(cacheFile, { ...cached, fetchedAt: now() });
      return { extensions: cached.catalog.extensions, fetchedAt: now(), from: 'network', problem: null };
    }
    if(!response.ok) throw new Error(`answered ${response.status}`);

    const body = await response.text();
    if(body.length > MAX_BYTES) throw new Error('the response is too large');

    const catalog = normalizeCatalog(JSON.parse(body));
    if(!catalog) throw new Error('the response is not a version 1 catalogue');

    await writeCache(cacheFile, { url, fetchedAt: now(), etag: response.headers?.get?.('etag') || null, catalog });
    return { extensions: catalog.extensions, fetchedAt: now(), from: 'network', problem: null };
  } catch(error) {
    const problem = `the extension catalogue could not be reached: ${error.message}`;
    if(cached) return { extensions: cached.catalog.extensions, fetchedAt: cached.fetchedAt, from: 'stale', problem };
    return fromSeed(problem);
  }
};

/*
  `seed` is the list used when nothing has ever been fetched. Concurrent callers share one fetch.
*/
export const getCatalog = async ({ url, cacheFile, seed = [], ttlMs = 5 * 60 * 1000, timeoutMs = 8000, fetchImpl = fetch, now = Date.now }) => {
  const key = `${cacheFile}\n${url}`;
  if(!inflight.has(key)){
    inflight.set(key, load({ url, cacheFile, seed, ttlMs, timeoutMs, fetchImpl, now }).finally(() => inflight.delete(key)));
  }
  return [null, await inflight.get(key)];
};
