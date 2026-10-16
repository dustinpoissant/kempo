import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray } from 'drizzle-orm';

/*
  Enabling an extension also enables what it requires that is switched off, and what those require, so
  nothing is ever enabled without its requirements, and only with the caller's say-so. Whatever else
  was switched off for its own reasons stays off.

    base  <-  middle  <-  top        top needs middle, middle needs base
    base  <-  side                   side needs base; nothing asks for it here
    gone                             required by "orphan", but not installed at all
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { extension } = await load('server/db/schema.js');
const { default: enableExtension } = await load('server/utils/extensions/enableExtension.js');
const { default: getRequirementTree } = await load('server/utils/extensions/getRequirementTree.js');

const NAMES = ['encascade-base', 'encascade-middle', 'encascade-top', 'encascade-side', 'encascade-orphan'];

const reset = async () => {
  await db.delete(extension).where(inArray(extension.name, NAMES));
  const now = new Date();
  const row = (name, dependencies = [], enabled = false) => ({ name, version: '1.0.0', enabled, kempo: { dependencies }, installedAt: now, updatedAt: now });
  await db.insert(extension).values([
    row('encascade-base'),
    row('encascade-middle', ['encascade-base']),
    row('encascade-top', ['encascade-middle']),
    row('encascade-side', ['encascade-base']),
    row('encascade-orphan', ['encascade-gone']),
  ]);
};

const state = async () => Object.fromEntries((await db.select().from(extension).where(inArray(extension.name, NAMES))).map(row => [row.name, row.enabled]));

export default {
  'the requirement tree lists everything required that is off, dependencies first, and what is not installed': async ({ pass, fail }) => {
    await reset();
    const top = await getRequirementTree('encascade-top');
    if(top.disabled.map(item => item.name).join() !== 'encascade-base,encascade-middle') return fail(`top: ${top.disabled.map(item => item.name)}`);
    if(top.disabled[1].requires.join() !== 'encascade-base') return fail(`middle requires: ${top.disabled[1].requires}`);
    if(top.missing.length) return fail(`missing: ${top.missing}`);

    const orphan = await getRequirementTree('encascade-orphan');
    if(orphan.missing.join() !== 'encascade-gone') return fail(`orphan missing: ${orphan.missing}`);

    await db.update(extension).set({ enabled: true }).where(eq(extension.name, 'encascade-base'));
    const afterBase = await getRequirementTree('encascade-top');
    if(afterBase.disabled.map(item => item.name).join() !== 'encascade-middle') return fail(`an enabled requirement was listed: ${afterBase.disabled.map(item => item.name)}`);
    pass('');
  },

  'without cascade nothing is enabled, and the whole chain is returned': async ({ pass, fail }) => {
    await reset();
    const [error] = await enableExtension({ name: 'encascade-top' });
    if(error?.code !== 409 || error.requirements?.length !== 2) return fail(`error: ${JSON.stringify(error)}`);
    const now = await state();
    if(Object.values(now).some(Boolean)) return fail(`something was enabled: ${JSON.stringify(now)}`);
    pass('');
  },

  'with cascade it and everything it requires are enabled together, and nothing else': async ({ pass, fail }) => {
    await reset();
    const [error, result] = await enableExtension({ name: 'encascade-top', cascade: true });
    if(error) return fail(`error: ${JSON.stringify(error)}`);
    if(result.enabledNames.slice().sort().join() !== 'encascade-base,encascade-middle,encascade-top') return fail(`enabled: ${result.enabledNames}`);
    const now = await state();
    if(!now['encascade-base'] || !now['encascade-middle'] || !now['encascade-top']) return fail(`state: ${JSON.stringify(now)}`);
    if(now['encascade-side']) return fail('an unrelated dependent of the base was enabled too');
    pass('');
  },

  'a requirement that is not installed refuses even with cascade, and names it': async ({ pass, fail }) => {
    await reset();
    const [error] = await enableExtension({ name: 'encascade-orphan', cascade: true });
    if(error?.code !== 409 || error.missing?.join() !== 'encascade-gone') return fail(`error: ${JSON.stringify(error)}`);
    if((await state())['encascade-orphan']) return fail('it was enabled anyway');
    pass('');
  },

  'an extension with nothing to enable first just enables, and an unknown one is a 404': async ({ pass, fail }) => {
    await reset();
    const [error, result] = await enableExtension({ name: 'encascade-base' });
    if(error || result.enabledNames.join() !== 'encascade-base') return fail(`${JSON.stringify(error || result)}`);
    const [missing] = await enableExtension({ name: 'encascade-nothing' });
    if(missing?.code !== 404) return fail(`unknown: ${JSON.stringify(missing)}`);
    await db.delete(extension).where(inArray(extension.name, NAMES));
    pass('');
  },
};
