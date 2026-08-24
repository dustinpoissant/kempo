import { symlink, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq } from 'drizzle-orm';

/*
  Exercises kempo.dependencies across install, enable, disable and uninstall using two fixtures:
  kempo-dependent-fixture declares a dependency on kempo-base-fixture. Each lifecycle boundary is
  checked in both directions — the dependent can't get ahead of a missing/disabled dependency, and
  the dependency can't be pulled out from under an enabled dependent.

  Requires a reachable Postgres with kempo's schema applied (`npx drizzle-kit push`). When the
  database cannot be reached the whole suite reports itself as skipped rather than failing, so a
  checkout without one still runs `npm test` cleanly. See tests/extension-lifecycle.node-test.js.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'kempo-base-fixture';
const DEPENDENT = 'kempo-dependent-fixture';

const db = (await import(pathToFileURL(path.join(root, 'server/db/index.js')).href)).default;
const schema = await import(pathToFileURL(path.join(root, 'server/db/schema.js')).href);
const { extension } = schema;

const installExtension = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/installExtension.js')).href)).default;
const uninstallExtension = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/uninstallExtension.js')).href)).default;
const enableExtension = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/enableExtension.js')).href)).default;
const disableExtension = (await import(pathToFileURL(path.join(root, 'server/utils/extensions/disableExtension.js')).href)).default;
const { invalidateScopeCache } = await import(pathToFileURL(path.join(root, 'server/utils/extensions/scopeCache.js')).href);

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const skipped = reason => ({
  'extension dependencies (SKIPPED)': async ({ pass }) => pass(`skipped: ${reason}`),
});

const purgeFixtures = async () => {
  await db.delete(extension).where(eq(extension.name, DEPENDENT)).catch(() => {});
  await db.delete(extension).where(eq(extension.name, BASE)).catch(() => {});
};

const linkFixture = async name => {
  const link = path.join(root, 'node_modules', name);
  await rm(link, { recursive: true, force: true }).catch(() => {});
  // junction avoids needing elevated privileges on Windows
  await symlink(path.join(root, 'tests', 'fixtures', name), link, 'junction');
};

const unlinkFixture = async name => {
  await rm(path.join(root, 'node_modules', name), { recursive: true, force: true }).catch(() => {});
};

const isEnabled = async name => {
  const [row] = await db.select().from(extension).where(eq(extension.name, name));
  return row?.enabled === true;
};

const buildTests = () => {
  const state = {};

  return {
    'install fails while the dependency is not installed and enabled': async ({ pass, fail }) => {
      await purgeFixtures();
      await linkFixture(BASE);
      await linkFixture(DEPENDENT);
      invalidateScopeCache();

      const [err] = await installExtension({ name: DEPENDENT });
      if(!err) return fail('install of the dependent succeeded with no dependency installed');
      if(err.code !== 409) return fail(`expected a 409, got ${err.code}: ${err.msg}`);

      const [row] = await db.select().from(extension).where(eq(extension.name, DEPENDENT));
      if(row) return fail('a rejected install still created an extension row');
      pass();
    },

    'install succeeds once the dependency is installed and enabled': async ({ pass, fail }) => {
      const [baseErr] = await installExtension({ name: BASE });
      if(baseErr) return fail(`install of the dependency returned an error: ${baseErr.msg}`);

      const [err] = await installExtension({ name: DEPENDENT });
      if(err) return fail(`install of the dependent returned an error: ${err.msg}`);

      state.installed = true;
      pass();
    },

    'enable fails while the dependency is disabled': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [disableDependentErr] = await disableExtension({ name: DEPENDENT });
      if(disableDependentErr) return fail(`disabling the dependent returned an error: ${disableDependentErr.msg}`);

      const [disableBaseErr] = await disableExtension({ name: BASE });
      if(disableBaseErr) return fail(`disabling the dependency returned an error: ${disableBaseErr.msg}`);

      const [err] = await enableExtension({ name: DEPENDENT });
      if(!err) return fail('enable of the dependent succeeded while the dependency was disabled');
      if(err.code !== 409) return fail(`expected a 409, got ${err.code}: ${err.msg}`);
      if(await isEnabled(DEPENDENT)) return fail('a rejected enable left the dependent enabled');
      pass();
    },

    're-enabling the dependency allows the dependent to enable': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [baseErr] = await enableExtension({ name: BASE });
      if(baseErr) return fail(`enabling the dependency returned an error: ${baseErr.msg}`);

      const [err] = await enableExtension({ name: DEPENDENT });
      if(err) return fail(`enable of the dependent returned an error: ${err.msg}`);
      if(!await isEnabled(DEPENDENT)) return fail('enable did not mark the dependent enabled');
      pass();
    },

    'disable fails while an enabled dependent still requires it': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [err] = await disableExtension({ name: BASE });
      if(!err) return fail('disable of the dependency succeeded while an enabled dependent required it');
      if(err.code !== 409) return fail(`expected a 409, got ${err.code}: ${err.msg}`);
      if(!await isEnabled(BASE)) return fail('a rejected disable left the dependency disabled');
      pass();
    },

    'disabling the dependent first allows the dependency to disable': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [dependentErr] = await disableExtension({ name: DEPENDENT });
      if(dependentErr) return fail(`disabling the dependent returned an error: ${dependentErr.msg}`);

      const [err] = await disableExtension({ name: BASE });
      if(err) return fail(`disable of the dependency returned an error: ${err.msg}`);
      pass();
    },

    'uninstall fails while an enabled dependent still requires it': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [baseErr] = await enableExtension({ name: BASE });
      if(baseErr) return fail(`re-enabling the dependency returned an error: ${baseErr.msg}`);
      const [dependentErr] = await enableExtension({ name: DEPENDENT });
      if(dependentErr) return fail(`re-enabling the dependent returned an error: ${dependentErr.msg}`);

      const [err] = await uninstallExtension({ name: BASE });
      if(!err) return fail('uninstall of the dependency succeeded while an enabled dependent required it');
      if(err.code !== 409) return fail(`expected a 409, got ${err.code}: ${err.msg}`);

      const [row] = await db.select().from(extension).where(eq(extension.name, BASE));
      if(!row) return fail('a rejected uninstall removed the extension row anyway');
      pass();
    },

    'uninstalling the dependent first allows the dependency to uninstall': async ({ pass, fail }) => {
      if(!state.installed) return fail('install step did not complete');

      const [dependentErr] = await uninstallExtension({ name: DEPENDENT, purgeData: true });
      if(dependentErr) return fail(`uninstalling the dependent returned an error: ${dependentErr.msg}`);

      const [err] = await uninstallExtension({ name: BASE, purgeData: true });
      if(err) return fail(`uninstall of the dependency returned an error: ${err.msg}`);

      await unlinkFixture(DEPENDENT);
      await unlinkFixture(BASE);
      pass();
    },
  };
};

export default databaseReachable
  ? buildTests()
  : skipped('no reachable database — set DATABASE_URL to a Postgres with kempo\'s schema applied (npx drizzle-kit push)');
