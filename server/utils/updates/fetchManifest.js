import { DEFAULT_REGISTRY, PACKAGE, isVersion } from './helpers.js';
import { NAME_PATTERN } from '../extensions/marketplaceClient.js';

/*
  Reads one version's manifest of a package (kempo by default, or an extension) from the npm registry, "latest" by default.
  Resolves to [error, { name, version, peerDependencies }].
*/
export default async ({ name = PACKAGE, version = 'latest', registry = process.env.KEMPO_NPM_REGISTRY || DEFAULT_REGISTRY, fetcher = fetch } = {}) => {
  if(typeof name !== 'string' || !NAME_PATTERN.test(name)){
    return [{ code: 400, msg: 'Package name is not valid' }, null];
  }
  if(version !== 'latest' && !isVersion(version)){
    return [{ code: 400, msg: 'Version is not valid' }, null];
  }

  try {
    const res = await fetcher(`${registry.replace(/\/+$/, '')}/${name.replace('/', '%2F')}/${version}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if(res.status === 404) return [{ code: 404, msg: `${name}${version === 'latest' ? '' : ` ${version}`} was not found on npm` }, null];
    if(!res.ok) return [{ code: 502, msg: `npm answered ${res.status}` }, null];
    const manifest = await res.json();
    if(!isVersion(manifest?.version)) return [{ code: 502, msg: 'npm did not return a usable version' }, null];
    return [null, { name, version: manifest.version, peerDependencies: manifest.peerDependencies ?? {} }];
  } catch {
    return [{ code: 502, msg: 'npm could not be reached' }, null];
  }
};
