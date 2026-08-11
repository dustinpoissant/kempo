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
const { adminGlobalDirs } = await import(pathToFileURL(path.join(root, 'middleware/kempo.js')).href);
const { invalidateScopeCache } = await import(pathToFileURL(path.join(root, 'server/utils/extensions/scopeCache.js')).href);

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

    'disabling removes the extension from the admin global scan': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [err] = await disableExtension({ name: FIXTURE });
      if(err) return fail(`disable returned an error: ${err.msg}`);

      const dirs = await adminGlobalDirs();
      const expected = path.join(root, 'node_modules', FIXTURE, 'admin');
      if(dirs.includes(expected)) return fail('a disabled extension still contributes its admin nav');

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

    'uninstall removes every trace': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [err] = await uninstallExtension({ name: FIXTURE });
      if(err) return fail(`uninstall returned an error: ${err.msg}`);

      const leftovers = [];
      if((await db.select().from(extension).where(eq(extension.name, FIXTURE))).length) leftovers.push('extension row');
      if((await db.select().from(permission).where(eq(permission.owner, FIXTURE))).length) leftovers.push('permissions');
      if((await db.select().from(group).where(eq(group.owner, FIXTURE))).length) leftovers.push('groups');
      if((await db.select().from(setting).where(like(setting.name, `${FIXTURE}:%`))).length) leftovers.push('settings');
      if((await db.select().from(hook).where(eq(hook.owner, FIXTURE))).length) leftovers.push('hooks');
      if(await tableExists('lifecycleFixtureItem')) leftovers.push('schema table');

      await purgeFixture();
      await rm(fixtureLink, { recursive: true, force: true }).catch(() => {});

      if(leftovers.length) return fail(`uninstall left behind: ${leftovers.join(', ')}`);
      pass();
    },
  };
};

export default databaseReachable
  ? buildTests()
  : skipped('no reachable database — set DATABASE_URL to a Postgres with kempo\'s schema applied (npx drizzle-kit push)');
