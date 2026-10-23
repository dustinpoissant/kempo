import path from 'path';
import os from 'os';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';

/*
  A hook handler is loaded once and remembered, which is right in production and wrong while developing: kempo-server's
  dev reload counts file changes in globalThis.kempoDevGeneration, and a handler is loaded again when the count moves.
*/
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { hook } = await load('server/db/schema.js');
const { default: triggerHook } = await load('server/utils/hooks/triggerHook.js');

const EVENT = 'test:hook-handler-dev-reload';

export default {
  'an edited hook handler is used once the dev reload count moves on, and not before': async ({ pass, fail }) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'kempo-hook-'));
    const handler = path.join(dir, 'handler.js');
    const previous = globalThis.kempoDevGeneration;
    try {
      await writeFile(handler, "export default async () => { globalThis.devHookProbe = 'one'; };\n");
      await db.delete(hook).where(eq(hook.event, EVENT));
      await db.insert(hook).values({ id: 'dev-reload-hook', owner: 'kempo', event: EVENT, callback: handler, createdAt: new Date() });

      globalThis.kempoDevGeneration = undefined;
      await triggerHook(EVENT);
      if(globalThis.devHookProbe !== 'one') return fail(`first run: ${globalThis.devHookProbe}`);

      await writeFile(handler, "export default async () => { globalThis.devHookProbe = 'two'; };\n");
      await triggerHook(EVENT);
      if(globalThis.devHookProbe !== 'one') return fail(`the handler is remembered while nothing changed: ${globalThis.devHookProbe}`);

      globalThis.kempoDevGeneration = 1;
      await triggerHook(EVENT);
      if(globalThis.devHookProbe !== 'two') return fail(`the edited handler is used after a change: ${globalThis.devHookProbe}`);
      pass('');
    } finally {
      globalThis.kempoDevGeneration = previous;
      delete globalThis.devHookProbe;
      await db.delete(hook).where(eq(hook.event, EVENT));
      await rm(dir, { recursive: true, force: true });
    }
  },
};
