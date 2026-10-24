import path from 'path';
import os from 'os';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, sql } from 'drizzle-orm';
import { seedDatabase } from './helpers/db.js';

/*
  Deleting your own account with a code emailed to the address on it, and the `user:deleted` hook that
  lets extensions remove what they keep about the person. Codes are read from the email log, which is
  where kempo records every email whether or not a sender is installed.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const schema = await load('server/db/schema.js');
const { email, hook, user, userGroup, group, verificationToken } = schema;
const createHook = (await load('server/utils/hooks/createHook.js')).default;
const deleteUser = (await load('server/utils/users/deleteUser.js')).default;
const createUser = (await load('server/utils/users/createUser.js')).default;
const { requestAccountDeletion, confirmAccountDeletion } = await load('server/utils/auth/accountDeletion.js');

const OWNER = 'account-deletion-test';
let directory;

const address = name => `${name}@account-deletion.test`;

const makePerson = async name => {
  const [error, created] = await createUser({ name: `Person ${name}`, email: address(name), password: 'a-password-nobody-guesses', emailVerified: true });
  if(error) throw new Error(error.msg);
  return created.user;
};

const codeSentTo = async who => {
  const [sent] = await db.select().from(email).where(eq(email.recipient, address(who))).orderBy(sql`"createdAt" desc`).limit(1);
  return sent?.html.match(/<h1[^>]*>\s*(\d{6})\s*<\/h1>/)?.[1];
};

const reset = async () => {
  await db.delete(hook).where(eq(hook.owner, OWNER));
  await db.execute(sql`delete from email where recipient like '%@account-deletion.test'`);
  await db.delete(verificationToken).where(eq(verificationToken.type, 'account_deletion'));
  await db.delete(user).where(sql`${user.email} like '%@account-deletion.test'`);
  globalThis.deletionHookSeen = [];
};

export const beforeAll = async () => {
  await seedDatabase();
  directory = await mkdtemp(path.join(os.tmpdir(), 'account-deletion-'));
};

export const afterAll = async () => {
  await reset();
  await rm(directory, { recursive: true, force: true });
};

export default {
  'a code is emailed to the account and deletes it when typed back': async ({ pass, fail }) => {
    await reset();
    const person = await makePerson('alice');
    const [requestError, sent] = await requestAccountDeletion({ email: address('alice') });
    if(requestError || !sent.sent) return fail(`request: ${JSON.stringify(requestError)}`);

    const code = await codeSentTo('alice');
    if(!/^\d{6}$/.test(code || '')) return fail('no code was emailed to the account');

    const [wrongError] = await confirmAccountDeletion({ email: address('alice'), code: code === '000000' ? '000001' : '000000' });
    if(wrongError?.code !== 400) return fail(`a wrong code: ${JSON.stringify(wrongError)}`);
    if(!(await db.select().from(user).where(eq(user.id, person.id))).length) return fail('a wrong code deleted the account');

    const [rightError, done] = await confirmAccountDeletion({ email: address('alice'), code });
    if(rightError || !done.deleted) return fail(`the right code: ${JSON.stringify(rightError)}`);
    if((await db.select().from(user).where(eq(user.id, person.id))).length) return fail('the account is still there');

    const [again] = await confirmAccountDeletion({ email: address('alice'), code });
    if(!again) return fail('the same code worked twice');
    pass('');
  },

  'nothing reveals whether an account exists, and no code is sent for an address with none': async ({ pass, fail }) => {
    await reset();
    const [error, answer] = await requestAccountDeletion({ email: address('nobody') });
    if(error || !answer.sent) return fail(`an unknown address: ${JSON.stringify(error)}`);
    const [sent] = await db.select().from(email).where(eq(email.recipient, address('nobody')));
    if(sent) return fail('an email was sent to an address with no account');
    pass('');
  },

  'a code dies after too many wrong tries, and a second request inside a minute sends nothing new': async ({ pass, fail }) => {
    await reset();
    await makePerson('bob');
    await requestAccountDeletion({ email: address('bob') });
    const code = await codeSentTo('bob');

    const [again] = await requestAccountDeletion({ email: address('bob') });
    if(again) return fail(`asked again at once: ${JSON.stringify(again)}`);
    const sentCount = (await db.select().from(email).where(eq(email.recipient, address('bob')))).length;
    if(sentCount !== 1) return fail(`${sentCount} emails inside a minute`);

    for(let i = 0; i < 5; i++) await confirmAccountDeletion({ email: address('bob'), code: code === '111111' ? '222222' : '111111' });
    const [dead] = await confirmAccountDeletion({ email: address('bob'), code });
    if(dead?.code !== 429) return fail(`the right code after five wrong ones: ${JSON.stringify(dead)}`);
    pass('');
  },

  'the last administrator cannot delete their own account': async ({ pass, fail }) => {
    await reset();
    const admin = await makePerson('admin');
    const now = new Date();
    await db.insert(group).values({ name: 'system:Administrators', description: 'Full system access', owner: 'system', createdAt: now }).onConflictDoNothing();
    await db.insert(userGroup).values({ id: `admin-${Date.now()}`, userId: admin.id, groupName: 'system:Administrators', createdAt: now });
    await db.delete(userGroup).where(sql`"userId" <> ${admin.id} and "groupName" = 'system:Administrators'`);

    await requestAccountDeletion({ email: address('admin') });
    const code = await codeSentTo('admin');
    const [error] = await confirmAccountDeletion({ email: address('admin'), code });
    if(error?.code !== 409) return fail(`the only administrator: ${JSON.stringify(error)}`);
    if(!(await db.select().from(user).where(eq(user.id, admin.id))).length) return fail('the only administrator was deleted');
    await db.delete(userGroup).where(eq(userGroup.userId, admin.id));
    pass('');
  },

  'deleting a user fires user:deleted with what an extension needs to clean up': async ({ pass, fail }) => {
    await reset();
    const handler = path.join(directory, 'seen.mjs');
    await writeFile(handler, 'export default async data => { globalThis.deletionHookSeen.push(data); };');
    const [hookError] = await createHook({ owner: OWNER, event: 'user:deleted', callback: handler });
    if(hookError) return fail(`could not register the hook: ${hookError.msg}`);

    const person = await makePerson('carol');
    const [error] = await deleteUser(person.id);
    if(error) return fail(JSON.stringify(error));

    const [seen] = globalThis.deletionHookSeen;
    if(!seen || seen.id !== person.id || seen.email !== address('carol')) return fail(`the hook saw ${JSON.stringify(seen)}`);
    pass('');
  },

  'a failing user:deleted handler does not undo the deletion': async ({ pass, fail }) => {
    await reset();
    const handler = path.join(directory, 'broken.mjs');
    await writeFile(handler, 'export default async () => { throw new Error("extension is broken"); };');
    await createHook({ owner: OWNER, event: 'user:deleted', callback: handler });

    const person = await makePerson('dan');
    const [error] = await deleteUser(person.id);
    if(error) return fail(JSON.stringify(error));
    if((await db.select().from(user).where(eq(user.id, person.id))).length) return fail('the account survived a broken hook');
    pass('');
  },
};
