import { join } from 'path';
import { getEnabledExtensions } from './scopeCache.js';

const NODE_MODULES = join(process.cwd(), 'node_modules');

/*
  The directories an enabled extension may contribute *.global.html and *.fragment.html from, split
  by which half of the site is rendering: `admin/` for the admin portal, `public/` for the live site.

  Each is read straight from the package at render time, the same way an extension's pages and
  routes are resolved, so nothing is copied anywhere on install: enabling, disabling, upgrading or
  removing an extension takes effect immediately, and there is nothing left behind to clean up.

  That is also the whole of the on/off switch for this content — a disabled extension drops out of
  these lists and its files are simply never read. There is no `enabled` flag on a packaged file the
  way there is on admin-authored global content, because there is no stored row to carry one.

  Lives here rather than in middleware/kempo.js so that server utils can reach it too — the 404 page
  is rendered from server/utils/routing/serveUnmatched.js, and importing the middleware from there
  would be circular.
*/
const extensionDirs = async sub =>
  (await getEnabledExtensions()).map(ext => join(NODE_MODULES, ext.name, sub));

export const extensionAdminDirs = () => extensionDirs('admin');

export const extensionPublicDirs = () => extensionDirs('public');
