import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  The two small things extensions building an account-at-checkout flow lean on: `user:email_verified`
  fires when someone proves they own an address, and a password-reset email can use a caller's subject
  and template.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { user, hook, verificationToken } = await load('server/db/schema.js');
const { default: verifyEmail } = await load('server/utils/auth/verifyEmail.js');
const { default: requestPasswordReset } = await load('server/utils/auth/requestPasswordReset.js');
const { default: createUser } = await load('server/utils/users/createUser.js');
const { clearHandlerCache } = await load('server/utils/hooks/triggerHook.js');

const databaseReachable = await reachable(db);
const capture = path.join(root, 'tests', 'fixtures', 'hook-recorder', 'capture.js');
const EMAIL = 'checkout-flow@example.test';

const purge = async () => {
  await db.delete(hook).where(eq(hook.event, 'user:email_verified')).catch(() => {});
  await db.delete(user).where(eq(user.email, EMAIL)).catch(() => {});
  clearHandlerCache();
};

export default databaseReachable ? {
  'verifying an email fires user:email_verified with the user and the address': async ({ pass, fail }) => {
    await purge();
    globalThis.capturedHooks = [];
    await db.insert(hook).values({ id: 'capture-verified', owner: 'kempo', event: 'user:email_verified', callback: capture, createdAt: new Date() });
    clearHandlerCache();

    const [createError, created] = await createUser({ name: 'Checkout Flow', email: EMAIL });
    if(createError) return fail(createError.msg);
    await db.insert(verificationToken).values({
      token: 'verify-token-1', userId: created.user.id, type: 'email_verification',
      expiresAt: new Date(Date.now() + 60000), createdAt: new Date(),
    });

    const [error] = await verifyEmail({ token: 'verify-token-1' });
    if(error) return fail(error.msg);
    const calls = globalThis.capturedHooks.map(JSON.parse);
    if(calls.length !== 1) return fail(`fired ${calls.length} times`);
    if(calls[0].userId !== created.user.id || calls[0].email !== EMAIL) return fail(`payload ${JSON.stringify(calls[0])}`);

    const [again] = await verifyEmail({ token: 'verify-token-1' });
    if(!again) return fail('a used token verified twice');
    if(globalThis.capturedHooks.length !== 1) return fail('fired again for a refused token');
    pass('');
  },

  'a password reset can use the caller\'s template': async ({ pass, fail }) => {
    const [error] = await requestPasswordReset({ email: EMAIL, subject: 'Set your password', template: 'no-such-extension/set-password' });
    if(!error || error.code !== 404 || !/no-such-extension\/set-password/.test(error.msg)) return fail(`got ${JSON.stringify(error)}`);
    const [unknown] = await requestPasswordReset({ email: 'nobody@example.test' });
    if(!unknown || unknown.code !== 404) return fail('an unknown address should still be 404');
    await purge();
    pass('');
  },
} : {
  'account flows (SKIPPED)': async ({ pass }) => pass('skipped: no database'),
};
