import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray } from 'drizzle-orm';

/*
  Disabling an extension that others require disables the whole chain above it, together, and only
  with the caller's say-so. The chain is built from rows, so nothing is installed from disk.

    base  <-  middle  <-  top        (top needs middle, middle needs base)
    base  <-  side                   (a second dependent of base)
    other                            (unrelated)
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { extension } = await load('server/db/schema.js');
const { default: disableExtension } = await load('server/utils/extensions/disableExtension.js');
const { default: enableExtension } = await load('server/utils/extensions/enableExtension.js');
const { default: getEnabledDependentTree } = await load('server/utils/extensions/dependentTree.js');

const NAMES = ['cascade-base', 'cascade-middle', 'cascade-top', 'cascade-side', 'cascade-other'];

const reset = async () => {
  await db.delete(extension).where(inArray(extension.name, NAMES));
  const now = new Date();
  const row = (name, dependencies = []) => ({ name, version: '1.0.0', enabled: true, kempo: { dependencies }, installedAt: now, updatedAt: now });
  await db.insert(extension).values([
    row('cascade-base'),
    row('cascade-middle', ['cascade-base']),
    row('cascade-top', ['cascade-middle']),
    row('cascade-side', ['cascade-base']),
    row('cascade-other'),
  ]);
};

const enabledState = async () => Object.fromEntries((await db.select().from(extension).where(inArray(extension.name, NAMES))).map(row => [row.name, row.enabled]));

export default {
  'the tree above an extension is every dependent, through any number of levels, deepest first': async ({ pass, fail }) => {
    await reset();
    const tree = await getEnabledDependentTree('cascade-base');
    const names = tree.map(item => item.name);
    if(names[0] !== 'cascade-top' || names.slice().sort().join() !== 'cascade-middle,cascade-side,cascade-top') return fail(`tree: ${names}`);
    const top = tree.find(item => item.name === 'cascade-top');
    if(top.requires.join() !== 'cascade-middle') return fail(`top requires: ${top.requires}`);
    if((await getEnabledDependentTree('cascade-other')).length) return fail('an unrelated extension has dependents');
    if((await getEnabledDependentTree('cascade-top')).length) return fail('the top of the chain has dependents');
    pass('');
  },

  'without cascade the whole tree is refused and returned, and nothing changes': async ({ pass, fail }) => {
    await reset();
    const [error] = await disableExtension({ name: 'cascade-base' });
    if(error?.code !== 409 || error.dependents?.length !== 3) return fail(`error: ${JSON.stringify(error)}`);
    const state = await enabledState();
    if(Object.values(state).some(enabled => !enabled)) return fail(`something was disabled: ${JSON.stringify(state)}`);
    pass('');
  },

  'with cascade the extension and everything that depends on it are disabled together, and nothing else': async ({ pass, fail }) => {
    await reset();
    const [error, result] = await disableExtension({ name: 'cascade-base', cascade: true });
    if(error) return fail(`error: ${JSON.stringify(error)}`);
    if(result.disabled.slice().sort().join() !== 'cascade-base,cascade-middle,cascade-side,cascade-top') return fail(`disabled: ${result.disabled}`);
    const state = await enabledState();
    if(state['cascade-base'] || state['cascade-middle'] || state['cascade-top'] || state['cascade-side']) return fail(`still enabled: ${JSON.stringify(state)}`);
    if(!state['cascade-other']) return fail('an unrelated extension was disabled');
    pass('');
  },

  'enabling is not cascaded: each is turned on in turn, dependencies first': async ({ pass, fail }) => {
    const [middleError] = await enableExtension({ name: 'cascade-middle' });
    if(middleError?.code !== 409) return fail(`middle enabled while base is off: ${JSON.stringify(middleError)}`);

    const [baseError] = await enableExtension({ name: 'cascade-base' });
    if(baseError) return fail(`base: ${baseError.msg}`);
    const state = await enabledState();
    if(state['cascade-middle'] || state['cascade-top']) return fail('enabling the base re-enabled its dependents');

    const [middle] = await enableExtension({ name: 'cascade-middle' });
    const [top] = await enableExtension({ name: 'cascade-top' });
    if(middle || top) return fail(`in order: ${JSON.stringify(middle || top)}`);

    await db.delete(extension).where(inArray(extension.name, NAMES));
    pass('');
  },

  'disabling something nothing depends on needs no cascade': async ({ pass, fail }) => {
    await reset();
    const [error, result] = await disableExtension({ name: 'cascade-top' });
    if(error || result.disabled.join() !== 'cascade-top') return fail(`${JSON.stringify(error || result)}`);
    const [row] = await db.select().from(extension).where(eq(extension.name, 'cascade-middle'));
    if(!row.enabled) return fail('its dependency was disabled');
    await db.delete(extension).where(inArray(extension.name, NAMES));
    pass('');
  },
};
