import getSetting from '../settings/getSetting.js';
import { createCatalogClient, DEFAULT_CATALOG_URL } from './marketplaceClient.js';

const clients = new Map();

/*
  This site's marketplace client. The address is the `system:extensions_catalog_url` setting: it
  defaults to https://kempo.dev/api/v1, and an empty value turns the marketplace off. It is
  deliberately not one of the seeded default settings, because seeding rewrites those on every run and
  would put a site's chosen address back.

  One client per address, so its in-memory cache outlives a request.
*/
export default async () => {
  const [, configured] = await getSetting('system', 'extensions_catalog_url', DEFAULT_CATALOG_URL);
  const baseUrl = typeof configured === 'string' ? configured.trim() : DEFAULT_CATALOG_URL;

  if(!clients.has(baseUrl)) clients.set(baseUrl, createCatalogClient({ baseUrl }));
  return clients.get(baseUrl);
};
