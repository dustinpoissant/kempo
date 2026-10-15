import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';

/*
  A disabled extension is not used by the CMS in any way, including its hooks: they stay registered but
  do not run, and run again once the extension is enabled. Hooks owned by anything that is not an
  installed extension (core, the site itself) are unaffected.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { extension, hook } = await load('server/db/schema.js');
const { default: triggerHook } = await load('server/utils/hooks/triggerHook.js');
const { default: disableExtension } = await load('server/utils/extensions/disableExtension.js');
const { default: enableExtension } = await load('server/utils/extensions/enableExtension.js');

const EXTENSION = 'hook-recorder-extension';
const EVENT = 'test:disabled-extension-hook';
const handler = path.join(root, 'tests', 'fixtures', 'hook-recorder', 'handler.js');

const calls = () => globalThis.disabledHookCalls || [];

const cleanup = async () => {
  await db.delete(hook).where(eq(hook.event, EVENT));
  await db.delete(extension).where(eq(extension.name, EXTENSION));
  globalThis.disabledHookCalls = [];
};

export default {
  'a disabled extension\'s hooks do not run, and run again when it is enabled': async ({ pass, fail }) => {
    await cleanup();
    const now = new Date();
    await db.insert(extension).values({ name: EXTENSION, version: '1.0.0', enabled: true, kempo: {}, installedAt: now, updatedAt: now });
    await db.insert(hook).values([
      { id: 'hook-recorder-1', owner: EXTENSION, event: EVENT, callback: handler, createdAt: new Date(now.getTime() + 1) },
      { id: 'hook-recorder-2', owner: 'kempo', event: EVENT, callback: handler, createdAt: new Date(now.getTime() + 2) },
    ]);

    await triggerHook(EVENT, { tag: 'enabled' });
    if(calls().join() !== 'enabled,enabled') return fail(`enabled: ${calls()}`);

    const [disableError] = await disableExtension({ name: EXTENSION });
    if(disableError) return fail(`disable: ${disableError.msg}`);
    await triggerHook(EVENT, { tag: 'disabled' });
    if(calls().join() !== 'enabled,enabled,disabled') return fail(`disabled (only the core hook should run): ${calls()}`);

    const [registered] = await db.select().from(hook).where(eq(hook.id, 'hook-recorder-1'));
    if(!registered) return fail('disabling removed the hook registration');

    const [enableError] = await enableExtension({ name: EXTENSION });
    if(enableError) return fail(`enable: ${enableError.msg}`);
    await triggerHook(EVENT, { tag: 'again' });
    if(calls().join() !== 'enabled,enabled,disabled,again,again') return fail(`re-enabled: ${calls()}`);

    await cleanup();
    pass('');
  },
};
