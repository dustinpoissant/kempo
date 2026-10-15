import { readFile } from 'fs/promises';
import { join } from 'path';
import getSetting from '../settings/getSetting.js';
import { getCatalog, DEFAULT_CATALOG_URL } from './catalog.js';

/*
  This site's view of the catalogue: where it is (the `system:extensions_catalog_url` setting, which
  defaults to https://extensions.kempo.dev and is disabled by an empty value), where it is cached, and
  the seed list for a site that has never reached it.

  The setting is deliberately not in the seeded defaults: seeding rewrites those on every run, which
  would put a site's chosen URL back.
*/
export default async () => {
  const [, configured] = await getSetting('system', 'extensions_catalog_url', DEFAULT_CATALOG_URL);

  let seed = [];
  try {
    seed = JSON.parse(await readFile(join(import.meta.dirname, 'known-extensions.json'), 'utf8'));
  } catch {
    seed = [];
  }

  return getCatalog({
    url: typeof configured === 'string' ? configured.trim() : DEFAULT_CATALOG_URL,
    cacheFile: join(process.cwd(), '.cache', 'extensions-catalog.json'),
    seed,
  });
};
