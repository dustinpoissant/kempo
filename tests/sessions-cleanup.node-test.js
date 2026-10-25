import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq, inArray } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  The scheduled clean-up of expired sessions, against a real database: only sessions that expired longer ago
  than the setting are removed, a 0 setting keeps them, and every user's sessions are considered, not one's.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const db = (await load('server/db/index.js')).default;
const { session } = await load('server/db/schema.js');
const sdk = await load('server/sdk.js');
const pruneExpiredSessions = (await load('server/utils/sessions/pruneExpiredSessions.js')).default;
const { createUser, deleteUser, setSetting } = sdk;

const databaseReachable = await reachable(db);

const HOUR = 3600000;
const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const state = { users: [], tokens: [] };

const makeUser = async suffix => {
  const email = `sessions-cleanup-${suffix}-${crypto.randomBytes(4).toString('hex')}@example.com`;
  const [error, created] = await createUser({ name: `Cleanup ${suffix}`, email, password: 'a-password-nobody-guesses', emailVerified: true });
  if(error) throw new Error(error.msg);
  state.users.push(created.user.id);
  return created.user.id;
};

const makeSession = async (userId, expiresAt) => {
  const token = crypto.randomBytes(16).toString('hex');
  await db.insert(session).values({ token, userId, expiresAt, createdAt: new Date(expiresAt.getTime() - 7 * 24 * HOUR) });
  state.tokens.push(token);
  return token;
};

const exists = async token => (await db.select({ token: session.token }).from(session).where(eq(session.token, token)).limit(1)).length === 1;

const cleanUp = async () => {
  if(state.tokens.length) await db.delete(session).where(inArray(session.token, state.tokens));
  for(const id of state.users) await deleteUser(id);
  state.users = [];
  state.tokens = [];
};

const buildTests = () => ({
  'a session that expired longer ago than the setting is removed, a recent one is kept': async ({ pass }) => {
    const now = new Date();
    const userId = await makeUser('window');
    const old = await makeSession(userId, new Date(now.getTime() - 48 * HOUR));
    const recent = await makeSession(userId, new Date(now.getTime() - 2 * HOUR));
    const live = await makeSession(userId, new Date(now.getTime() + 24 * HOUR));

    const [error] = await pruneExpiredSessions({ now, hours: 24 });
    expect(!error, `the clean-up failed: ${error?.msg}`);
    expect(!(await exists(old)), 'a session expired 48 hours ago should be gone at a 24 hour setting');
    expect(await exists(recent), 'a session that expired 2 hours ago should be kept at a 24 hour setting');
    expect(await exists(live), 'a session that has not expired must never be removed');

    await cleanUp();
    pass();
  },

  'a setting of 0 keeps expired sessions': async ({ pass }) => {
    const now = new Date();
    const userId = await makeUser('forever');
    const old = await makeSession(userId, new Date(now.getTime() - 500 * HOUR));

    const [error, result] = await pruneExpiredSessions({ now, hours: 0 });
    expect(!error && result.deleted === 0, 'zero hours should delete nothing');
    expect(await exists(old), 'a 0 setting must keep the session');

    await cleanUp();
    pass();
  },

  'the setting is read from the site when no hours are given': async ({ pass }) => {
    const now = new Date();
    const userId = await makeUser('setting');
    const old = await makeSession(userId, new Date(now.getTime() - 10 * HOUR));

    await setSetting('system', 'session_cleanup_hours', 4, 'number', false, 'test');
    const [error] = await pruneExpiredSessions({ now });
    expect(!error, `the clean-up failed: ${error?.msg}`);
    expect(!(await exists(old)), 'a 4 hour setting should remove a session that expired 10 hours ago');

    await setSetting('system', 'session_cleanup_hours', 24, 'number', false, 'test');
    await cleanUp();
    pass();
  },
});

export default databaseReachable
  ? buildTests()
  : { 'sessions cleanup (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database, set DATABASE_URL to a Postgres with kempo\'s schema applied') };
