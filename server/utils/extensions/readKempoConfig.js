import { join } from 'path';
import { readFile } from 'fs/promises';

/*
  What an installed extension declares to kempo: its `public-scope` and `public-scopes`, `docs`, `git`, `schema`, `hooks`,
  `permissions`, `settings`, `groups`, `dependencies`, `widgets`, `jobs` and `aliases`.

  It lives in the extension's kempo-config.json, which is the one place it is written. package.json's own
  `kempo` field is still read, as the fallback for an older extension that put everything there, and
  kempo-config.json wins field by field. Nothing should add new keys to package.json.

  Reads both files fresh each time, so an extension replaced on disk is seen without a restart.
  Throws when package.json cannot be read, which is how a caller knows the package is not installed.
*/
export default async extRoot => {
  const pkg = JSON.parse(await readFile(join(extRoot, 'package.json'), 'utf-8'));
  const config = await readFile(join(extRoot, 'kempo-config.json'), 'utf-8').then(JSON.parse, () => ({}));

  return { pkg, kempo: { ...(pkg.kempo || {}), ...config } };
};
