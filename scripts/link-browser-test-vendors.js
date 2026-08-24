import { symlink, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/*
  kempo-testing-framework's browser test server is a flat static file server rooted at the project
  directory (basePath -> `.${basePath}`) — it has no concept of kempo-server's routing, which is
  what normally maps /kempo-ui/**, /kempo/** and /kempo-css/** onto node_modules and dist/ at
  request time. Absolute-path imports in admin components (e.g. PageEditor.js importing
  '/kempo-ui/components/ShadowComponent.js') resolve against the origin root regardless of where
  the importing file itself was served from, so those three prefixes need to exist as real paths
  relative to the project root for the browser to find them — junctions do that without copying
  anything. 'junction' (not a symlink) avoids needing elevated privileges on Windows, matching the
  fixture-linking pattern already used in tests/extension-lifecycle.node-test.js.
*/

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const LINKS = [
  ['kempo-ui', join('node_modules', 'kempo-ui', 'dist')],
  ['kempo-css', join('node_modules', 'kempo-css', 'dist')],
  ['kempo', join('dist', 'kempo')],
];

const remove = process.argv.includes('--remove');

for(const [link, target] of LINKS){
  const linkPath = join(root, link);
  await rm(linkPath, { recursive: true, force: true });
  if(!remove){
    await symlink(join(root, target), linkPath, 'junction');
  }
}
