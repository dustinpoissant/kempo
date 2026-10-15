import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray } from 'drizzle-orm';

/*
  Uninstalling an extension that others require uninstalls them too, because none may stay installed
  without what it requires. Disabled ones count: installed-but-off is still installed.

    base  <-  middle  <-  top        top needs middle, middle needs base
    base  <-  dormant                dormant needs base, and is disabled
    other                            unrelated
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { extension, setting } = await load('server/db/schema.js');
const { default: uninstallExtension } = await load('server/utils/extensions/uninstallExtension.js');
const { default: getDependentTree } = await load('server/utils/extensions/getDependentTree.js');

const NAMES = ['uncascade-base', 'uncascade-middle', 'uncascade-top', 'uncascade-dormant', 'uncascade-other'];
const FLAGS = NAMES.map(name => `${name}:flag`);

const clear = async () => {
  await db.delete(setting).where(inArray(setting.name, FLAGS));
  await db.delete(extension).where(inArray(extension.name, NAMES));
};

const reset = async () => {
  await clear();
  const now = new Date();
  const row = (name, dependencies = [], enabled = true) => ({ name, version: '1.0.0', enabled, kempo: { dependencies }, installedAt: now, updatedAt: now });
  await db.insert(extension).values([
    row('uncascade-base'),
    row('uncascade-middle', ['uncascade-base']),
    row('uncascade-top', ['uncascade-middle']),
    row('uncascade-dormant', ['uncascade-base'], false),
    row('uncascade-other'),
  ]);
  await db.insert(setting).values(FLAGS.map(name => ({ name, value: 'on', type: 'string', isPublic: false, createdAt: now, updatedAt: now })));
};

const installed = async () => (await db.select({ name: extension.name }).from(extension).where(inArray(extension.name, NAMES))).map(row => row.name).sort();
const flags = async () => (await db.select({ name: setting.name }).from(setting).where(inArray(setting.name, FLAGS))).length;

export default {
  'the uninstall tree includes disabled dependents, which the disable tree leaves out': async ({ pass, fail }) => {
    await reset();
    const everything = await getDependentTree('uncascade-base', { includeDisabled: true });
    const enabledOnly = await getDependentTree('uncascade-base');
    if(everything.map(item => item.name).sort().join() !== 'uncascade-dormant,uncascade-middle,uncascade-top') return fail(`all: ${everything.map(item => item.name)}`);
    if(enabledOnly.map(item => item.name).sort().join() !== 'uncascade-middle,uncascade-top') return fail(`enabled only: ${enabledOnly.map(item => item.name)}`);
    if(everything.find(item => item.name === 'uncascade-dormant').enabled !== false) return fail('a disabled dependent was reported as enabled');
    pass('');
  },

  'without cascade the whole tree is refused and returned, disabled ones included, and nothing is removed': async ({ pass, fail }) => {
    await reset();
    const [error] = await uninstallExtension({ name: 'uncascade-base' });
    if(error?.code !== 409 || error.dependents?.length !== 3) return fail(`error: ${JSON.stringify(error)}`);
    if((await installed()).length !== 5) return fail(`something was removed: ${await installed()}`);
    pass('');
  },

  'with cascade everything that depends on it is uninstalled first, deepest first, then it, and nothing else': async ({ pass, fail }) => {
    await reset();
    const [error, result] = await uninstallExtension({ name: 'uncascade-base', cascade: true });
    if(error) return fail(`error: ${JSON.stringify(error)}`);
    if(result.uninstalled[0] !== 'uncascade-top' || result.uninstalled.at(-1) !== 'uncascade-base') return fail(`order: ${result.uninstalled}`);
    if(result.uninstalled.length !== 4) return fail(`uninstalled: ${result.uninstalled}`);
    if((await installed()).join() !== 'uncascade-other') return fail(`left installed: ${await installed()}`);
    pass('');
  },

  'data is kept by default and deleted for all of them when purging': async ({ pass, fail }) => {
    await reset();
    await uninstallExtension({ name: 'uncascade-base', cascade: true });
    if(await flags() !== 5) return fail(`settings were deleted without purge: ${await flags()} left`);

    await reset();
    const [error] = await uninstallExtension({ name: 'uncascade-base', cascade: true, purgeData: true });
    if(error) return fail(`purge: ${JSON.stringify(error)}`);
    if(await flags() !== 1) return fail(`after purge, ${await flags()} settings left (only the unrelated one should be)`);
    await clear();
    pass('');
  },

  'an extension nothing depends on is uninstalled without any cascade': async ({ pass, fail }) => {
    await reset();
    const [error, result] = await uninstallExtension({ name: 'uncascade-top' });
    if(error || result.uninstalled.join() !== 'uncascade-top') return fail(`${JSON.stringify(error || result)}`);
    const [middle] = await db.select().from(extension).where(eq(extension.name, 'uncascade-middle'));
    if(!middle) return fail('its requirement was uninstalled');
    await clear();
    pass('');
  },

  'an unknown extension is a 404': async ({ pass, fail }) => {
    const [error] = await uninstallExtension({ name: 'uncascade-nothing', cascade: true });
    if(error?.code !== 404) return fail(`${JSON.stringify(error)}`);
    pass('');
  },
};
