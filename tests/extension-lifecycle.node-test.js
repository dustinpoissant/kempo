import { symlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readFile } from 'fs/promises';
import { sql, eq, like } from 'drizzle-orm';

/*
  Exercises an extension through install → disable → enable → uninstall against a real database.

  This covers the failures that only appear across a lifecycle boundary, which no unit test would
  have found:
    - extension-owned admin nav was written into kempo's dist/admin, and `npm run build` deletes
      dist/ wholesale, so rebuilding the framework silently destroyed it
    - nothing removed that nav on disable, so a disabled extension kept its admin nav entry forever

  Requires a reachable Postgres with kempo's schema applied (`npx drizzle-kit push`). When the
  database cannot be reached the whole suite reports itself as skipped rather than failing, so a
  checkout without one still runs `npm test` cleanly.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = 'kempo-lifecycle-fixture';
const fixtureSource = path.join(root, 'tests', 'fixtures', FIXTURE);
const fixtureLink = path.join(root, 'node_modules', FIXTURE);

const db = (await import(pathToFileURL(path.join(root, 'server/db/index.js')).href)).default;
const schema = await import(pathToFileURL(path.join(root, 'server/db/schema.js')).href);
const { extension, hook, permission, group, groupPermission, setting } = schema;

const installExtension = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/installExtension.js')).href)).default;
const uninstallExtension = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/uninstallExtension.js')).href)).default;
const enableExtension = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/enableExtension.js')).href)).default;
const disableExtension = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/disableExtension.js')).href)).default;
const { adminGlobalDirs, adminFragmentDirs } = await import(pathToFileURL(path.join(root, 'middleware/kempo.js')).href);
const { extensionPublicDirs } = await import(pathToFileURL(path.join(root, 'server/utils/extensions/contentDirs.js')).href);
const { renderExternalPage } = await import('kempo-server/templating');
const { invalidateScopeCache } = await import(pathToFileURL(path.join(root, 'server/utils/extensions/scopeCache.js')).href);
const getSetting = (await import(pathToFileURL(path.join(root, 'server/utils/settings/getSetting.js')).href)).default;

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const skipped = reason => ({
  'extension lifecycle (SKIPPED)': async ({ pass }) => pass(`skipped: ${reason}`),
});

/*
  Leave the database exactly as found: drop the fixture rows whether or not the run got that far.
*/
const purgeFixture = async () => {
  await db.delete(groupPermission).where(eq(groupPermission.groupName, 'lifecycle-fixture:members')).catch(() => {});
  await db.delete(group).where(eq(group.owner, FIXTURE)).catch(() => {});
  await db.delete(permission).where(eq(permission.owner, FIXTURE)).catch(() => {});
  await db.delete(setting).where(like(setting.name, `${FIXTURE}:%`)).catch(() => {});
  await db.delete(hook).where(eq(hook.owner, FIXTURE)).catch(() => {});
  await db.delete(extension).where(eq(extension.name, FIXTURE)).catch(() => {});
  await db.execute(sql`DROP TABLE IF EXISTS "lifecycleFixtureItem" CASCADE`).catch(() => {});
};

const linkFixture = async () => {
  await rm(fixtureLink, { recursive: true, force: true }).catch(() => {});
  // junction avoids needing elevated privileges on Windows
  await symlink(fixtureSource, fixtureLink, 'junction');
};

const tableExists = async name => {
  const [row] = await db.execute(sql`select to_regclass(${`public."${name}"`}) as reg`);
  return Boolean(row?.reg);
};

const buildTests = () => {
  const state = {};

  return {
    'install registers the extension and its declared resources': async ({ pass, fail }) => {
      await purgeFixture();
      await linkFixture();
      invalidateScopeCache();

      const [err] = await installExtension({ name: FIXTURE });
      if(err) return fail(`install returned an error: ${err.msg}`);

      const [row] = await db.select().from(extension).where(eq(extension.name, FIXTURE));
      if(!row) return fail('no extension row was created');
      if(row.enabled !== true) return fail(`expected enabled=true, got ${row.enabled}`);

      const perms = await db.select().from(permission).where(eq(permission.owner, FIXTURE));
      if(perms.length !== 2) return fail(`expected 2 declared permissions, got ${perms.length}`);

      const groups = await db.select().from(group).where(eq(group.owner, FIXTURE));
      if(groups.length !== 1) return fail(`expected 1 declared group, got ${groups.length}`);

      const grants = await db.select().from(groupPermission).where(eq(groupPermission.groupName, 'lifecycle-fixture:members'));
      if(!grants.length) return fail('group permission grant was not created');

      // Settings carry ownership in the name as "extname:settingname"; there is no owner column
      const settings = await db.select().from(setting).where(like(setting.name, `${FIXTURE}:%`));
      if(!settings.length) return fail('declared setting was not created');

      /*
        A json setting has to survive the round trip as the thing it describes, not as text.

        kempo-config.json declares every default as a string — that is what the extension docs say
        to write — while setSetting takes the real value and serialises it according to the type.
        For every scalar type those agree; for json they do not, and storing the declared string
        unparsed encodes it a second time. Reading it back then yields the JSON text rather than the
        array, which no code errors on: the extension simply behaves as though the setting were
        empty. Found by kempo-thumbs, whose sizes are declared this way.
      */
      const [jsonError, jsonValue] = await getSetting(FIXTURE, 'fixture_json_setting');
      if(jsonError) return fail(`declared json setting could not be read: ${jsonError.msg}`);
      if(!Array.isArray(jsonValue)){
        return fail(`a json setting read back as ${typeof jsonValue} rather than an array: ${JSON.stringify(jsonValue)}`);
      }
      if(jsonValue[0]?.label !== 'sm') return fail(`json setting contents were not preserved: ${JSON.stringify(jsonValue)}`);

      const hooks = await db.select().from(hook).where(eq(hook.owner, FIXTURE));
      if(hooks.length !== 1) return fail(`expected 1 registered hook, got ${hooks.length}`);

      if(!await tableExists('lifecycleFixtureItem')) return fail('declared schema table was not created');

      state.installed = true;
      pass();
    },

    'the admin nav entry is read from the extension package, never written into dist/': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const dirs = await adminGlobalDirs();
      const expected = path.join(root, 'node_modules', FIXTURE, 'admin');
      if(!dirs.includes(expected)) return fail(`enabled extension's admin dir missing from the global scan:\n    got ${JSON.stringify(dirs)}`);

      /*
        The regression this guards: install used to write the nav into kempo's own dist/admin,
        which the build deletes. Nothing extension-owned may live there.
      */
      const distGlobals = path.join(root, 'dist', 'admin', 'kempo-global.global.html');
      if(existsSync(distGlobals)){
        const contents = await readFile(distGlobals, 'utf8');
        if(contents.includes(FIXTURE)) return fail(`install wrote extension-owned content into dist/admin, which \`npm run build\` deletes:\n    ${distGlobals}`);
      }

      // The markup ships in the package, so a rebuild of kempo cannot affect it
      const packaged = path.join(fixtureSource, 'admin', 'nav.global.html');
      if(!existsSync(packaged)) return fail('fixture is missing its packaged nav.global.html');
      pass();
    },

    /*
      The public half of the same idea. Until extension content dirs existed an extension could ship
      its own pages but could not add anything to anyone else's: public renders passed no extra
      directories at all, so a *.global.html or *.fragment.html inside a package was never read
      outside /admin.
    */
    'an enabled extension contributes its public dir to site renders': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const dirs = await extensionPublicDirs();
      const expected = path.join(root, 'node_modules', FIXTURE, 'public');
      if(!dirs.includes(expected)) return fail(`enabled extension's public dir missing:\n    got ${JSON.stringify(dirs)}`);

      // Admin fragments come from the package too, and never from the admin-authored globals dir
      const fragmentDirs = await adminFragmentDirs();
      const expectedAdmin = path.join(root, 'node_modules', FIXTURE, 'admin');
      if(!fragmentDirs.includes(expectedAdmin)) return fail(`enabled extension's admin dir missing from the fragment scan:\n    got ${JSON.stringify(fragmentDirs)}`);
      if(fragmentDirs.some(dir => dir.includes('.kempo'))) return fail(`admin-authored globals dir leaked into the fragment scan: ${JSON.stringify(fragmentDirs)}`);

      pass();
    },

    'a public page render picks up the extension\'s pushed content and pulled fragment': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      /*
        The end-to-end proof, rendered exactly the way the middleware renders a consumer page: a
        <location> the extension knows the name of, and a <fragment> the page asks for by name
        without knowing who supplies it.
      */
      const { mkdtemp, writeFile } = await import('fs/promises');
      const os = await import('os');
      const tmp = await mkdtemp(path.join(os.tmpdir(), 'kempo-pubdirs-'));
      await writeFile(
        path.join(tmp, 'default.template.html'),
        '<html><body><location name="site-banner" /><fragment name="promo">no promo</fragment></body></html>'
      );
      await writeFile(path.join(tmp, 'index.page.html'), '<page></page>');

      const contentDirs = await extensionPublicDirs();
      const html = await renderExternalPage(
        path.join(tmp, 'index.page.html'), tmp, tmp, {}, {}, 10, contentDirs, contentDirs
      );

      if(!html.includes('data-fixture-banner')) return fail(`extension global content did not reach the page:\n    ${html}`);
      if(!html.includes('data-fixture-promo')) return fail(`extension fragment did not reach the page:\n    ${html}`);
      if(html.includes('no promo')) return fail(`the inline fallback rendered instead of the extension's fragment:\n    ${html}`);

      // Without the extension dirs the same page must render exactly as it did before this feature
      const bare = await renderExternalPage(path.join(tmp, 'index.page.html'), tmp, tmp);
      if(bare.includes('data-fixture-banner') || bare.includes('data-fixture-promo')){
        return fail(`extension content leaked into a render that passed no extra dirs:\n    ${bare}`);
      }
      if(!bare.includes('no promo')) return fail(`the inline fallback should render with no extra dirs:\n    ${bare}`);

      await rm(tmp, { recursive: true, force: true }).catch(() => {});
      pass();
    },

    'disabling removes the extension from the admin global scan': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [err] = await disableExtension({ name: FIXTURE });
      if(err) return fail(`disable returned an error: ${err.msg}`);

      const dirs = await adminGlobalDirs();
      const expected = path.join(root, 'node_modules', FIXTURE, 'admin');
      if(dirs.includes(expected)) return fail('a disabled extension still contributes its admin nav');

      /*
        Being dropped from these lists is the whole of the on/off switch for packaged content —
        there is no stored row to carry an `enabled` flag the way admin-authored globals have one.
      */
      const publicDirs = await extensionPublicDirs();
      const expectedPublic = path.join(root, 'node_modules', FIXTURE, 'public');
      if(publicDirs.includes(expectedPublic)) return fail('a disabled extension still contributes public content');

      const [row] = await db.select().from(extension).where(eq(extension.name, FIXTURE));
      if(row?.enabled !== false) return fail(`expected enabled=false, got ${row?.enabled}`);
      pass();
    },

    'enabling puts it back': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [err] = await enableExtension({ name: FIXTURE });
      if(err) return fail(`enable returned an error: ${err.msg}`);

      const dirs = await adminGlobalDirs();
      const expected = path.join(root, 'node_modules', FIXTURE, 'admin');
      if(!dirs.includes(expected)) return fail('a re-enabled extension does not contribute its admin nav');
      pass();
    },

    'uninstall keeps the extension data by default': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [err] = await uninstallExtension({ name: FIXTURE });
      if(err) return fail(`uninstall returned an error: ${err.msg}`);

      // Deregistered, and its hooks are gone — a hook whose module is absent would abort renders
      if((await db.select().from(extension).where(eq(extension.name, FIXTURE))).length) return fail('extension row survived uninstall');
      if((await db.select().from(hook).where(eq(hook.owner, FIXTURE))).length) return fail('hooks survived uninstall');

      // Everything a reinstall would need to restore the site is still here
      const kept = [];
      if(!(await db.select().from(permission).where(eq(permission.owner, FIXTURE))).length) kept.push('permissions');
      if(!(await db.select().from(group).where(eq(group.owner, FIXTURE))).length) kept.push('groups');
      if(!(await db.select().from(setting).where(like(setting.name, `${FIXTURE}:%`))).length) kept.push('settings');
      if(!await tableExists('lifecycleFixtureItem')) kept.push('schema table');

      if(kept.length) return fail(`a non-purging uninstall destroyed: ${kept.join(', ')}`);
      pass();
    },

    'uninstall with purgeData removes every trace': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      // Reinstall over the kept data, then purge
      const [installErr] = await installExtension({ name: FIXTURE });
      if(installErr) return fail(`reinstall over kept data failed: ${installErr.msg}`);

      const [err] = await uninstallExtension({ name: FIXTURE, purgeData: true });
      if(err) return fail(`purging uninstall returned an error: ${err.msg}`);

      const leftovers = [];
      if((await db.select().from(extension).where(eq(extension.name, FIXTURE))).length) leftovers.push('extension row');
      if((await db.select().from(permission).where(eq(permission.owner, FIXTURE))).length) leftovers.push('permissions');
      if((await db.select().from(group).where(eq(group.owner, FIXTURE))).length) leftovers.push('groups');
      if((await db.select().from(setting).where(like(setting.name, `${FIXTURE}:%`))).length) leftovers.push('settings');
      if((await db.select().from(hook).where(eq(hook.owner, FIXTURE))).length) leftovers.push('hooks');
      if(await tableExists('lifecycleFixtureItem')) leftovers.push('schema table');

      await purgeFixture();
      await rm(fixtureLink, { recursive: true, force: true }).catch(() => {});

      if(leftovers.length) return fail(`purging uninstall left behind: ${leftovers.join(', ')}`);
      pass();
    },
  };
};

export default databaseReachable
  ? buildTests()
  : skipped('no reachable database — set DATABASE_URL to a Postgres with kempo\'s schema applied (npx drizzle-kit push)');
