import { mkdtemp, readFile, writeFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { eq } from 'drizzle-orm';
import { reachable } from './helpers/db.js';

/*
  The key that encrypts stored credentials is made for a site that has none: from the environment or
  .env when there is one, generated into .env when nothing is encrypted yet, and refused when generating
  would orphan what is already stored.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);

const db = (await load('server/db/index.js')).default;
const { setting } = await load('server/db/schema.js');
const { ensureEncryptionKey, resetEncryptionKey } = await load('server/utils/settings/ensureEncryptionKey.js');
const { encryptSecret, decryptSecret } = await load('server/utils/settings/secretCrypto.js');

const databaseReachable = await reachable(db);

const NAME = 'SETTINGS_ENCRYPTION_KEY';
const HEX = /^[0-9a-f]{64}$/;
const original = process.env[NAME];
const dirs = [];

const site = async (files = {}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kempo-key-'));
  dirs.push(dir);
  for(const [name, text] of Object.entries(files)) await writeFile(path.join(dir, name), text);
  return dir;
};

const read = async (dir, name) => readFile(path.join(dir, name), 'utf8').catch(() => null);

const fresh = async () => {
  delete process.env[NAME];
  resetEncryptionKey();
  await db.delete(setting).where(eq(setting.type, 'secret'));
};

const addSecret = () => db.insert(setting).values({ name: 'test:stored-secret', value: 'ciphertext', type: 'secret', isPublic: false, createdAt: new Date(), updatedAt: new Date() });

const restore = async () => {
  if(original === undefined) delete process.env[NAME];
  else process.env[NAME] = original;
  resetEncryptionKey();
  await db.delete(setting).where(eq(setting.type, 'secret')).catch(() => {});
  for(const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
};

export const afterAll = restore;

export default databaseReachable ? {
  'a key in the environment wins and nothing is written': async ({ pass, fail }) => {
    await fresh();
    const dir = await site();
    process.env[NAME] = 'a'.repeat(64);
    const [error, result] = await ensureEncryptionKey({ cwd: dir });
    if(error || result.source !== 'environment') return fail(`${error?.msg} ${result?.source}`);
    if(await read(dir, '.env') !== null) return fail('a .env was written although the environment had a key');
    pass('');
  },

  'a key that is not 64 hex characters is refused, not replaced': async ({ pass, fail }) => {
    await fresh();
    const dir = await site();
    process.env[NAME] = 'not-a-key';
    const [error] = await ensureEncryptionKey({ cwd: dir });
    if(!error || !/64-character/.test(error.msg)) return fail(`error ${error?.msg}`);
    if(process.env[NAME] !== 'not-a-key' || await read(dir, '.env') !== null) return fail('a bad key was overwritten');
    pass('');
  },

  'a key in .env that the process did not start with is picked up': async ({ pass, fail }) => {
    await fresh();
    const key = 'b'.repeat(64);
    const dir = await site({ '.env': `PORT=9876\n${NAME}="${key}"\n` });
    const [error, result] = await ensureEncryptionKey({ cwd: dir });
    if(error || result.source !== 'file' || process.env[NAME] !== key) return fail(`${error?.msg} ${result?.source} ${process.env[NAME]}`);
    pass('');
  },

  'with nothing stored a key is generated into .env, which stays out of git': async ({ pass, fail }) => {
    await fresh();
    const dir = await site({ '.env': 'PORT=9876', '.gitignore': 'node_modules' });
    const [error, result] = await ensureEncryptionKey({ cwd: dir });
    if(error || result.source !== 'generated') return fail(`${error?.msg} ${result?.source}`);
    const key = process.env[NAME];
    if(!HEX.test(key)) return fail(`key ${key}`);
    const file = await read(dir, '.env');
    if(!file.includes(`${NAME}=${key}\n`) || !file.startsWith('PORT=9876\n')) return fail(`.env ${JSON.stringify(file)}`);
    if(!/^\.env$/m.test(await read(dir, '.gitignore'))) return fail('.gitignore does not name .env');
    if(process.platform !== 'win32' && ((await stat(path.join(dir, '.env'))).mode & 0o077) !== 0) return fail('.env is readable by others');
    pass('');
  },

  'an empty SETTINGS_ENCRYPTION_KEY= line is filled in, not duplicated': async ({ pass, fail }) => {
    await fresh();
    const dir = await site({ '.env': `A=1\n${NAME}=\nB=2\n` });
    const [error] = await ensureEncryptionKey({ cwd: dir });
    if(error) return fail(error.msg);
    const file = await read(dir, '.env');
    if(file.split(NAME).length !== 2 || !file.includes('A=1\n') || !file.includes('B=2\n') || !file.includes(`${NAME}=${process.env[NAME]}`)) return fail(`.env ${JSON.stringify(file)}`);
    pass('');
  },

  'a site that already has encrypted settings is never given a new key': async ({ pass, fail }) => {
    await fresh();
    await addSecret();
    const dir = await site({ '.env': 'PORT=9876\n' });
    const [error] = await ensureEncryptionKey({ cwd: dir });
    if(!error || !/unreadable|encrypted setting/.test(error.msg)) return fail(`error ${error?.msg}`);
    if(process.env[NAME] || await read(dir, '.env') !== 'PORT=9876\n') return fail('a key was made although secrets were stored');
    pass('');
  },

  'when .env cannot be written there is an error and no key kept only in memory': async ({ pass, fail }) => {
    await fresh();
    const dir = path.join(await site(), 'does', 'not', 'exist');
    const [error] = await ensureEncryptionKey({ cwd: dir });
    if(!error || !/Could not save/.test(error.msg)) return fail(`error ${error?.msg}`);
    if(process.env[NAME]) return fail('the key was set for this process although it was not saved');
    pass('');
  },

  'callers at the same moment share one key': async ({ pass, fail }) => {
    await fresh();
    const dir = await site();
    const results = await Promise.all([ensureEncryptionKey({ cwd: dir }), ensureEncryptionKey({ cwd: dir }), ensureEncryptionKey({ cwd: dir })]);
    if(results.some(([error]) => error)) return fail(results.map(([error]) => error?.msg).join(', '));
    const file = await read(dir, '.env');
    if(file.split(`${NAME}=`).length !== 2) return fail(`.env ${JSON.stringify(file)}`);
    pass('');
  },

  'a generated key encrypts and decrypts, and a different key says what is wrong': async ({ pass, fail }) => {
    await fresh();
    const dir = await site();
    await ensureEncryptionKey({ cwd: dir });
    const sealed = encryptSecret('sk_test_123');
    if(decryptSecret(sealed) !== 'sk_test_123') return fail('did not round-trip');
    process.env[NAME] = 'c'.repeat(64);
    try {
      decryptSecret(sealed);
      return fail('a different key decrypted it');
    } catch(error) {
      if(!/not the key it was saved with/.test(error.message)) return fail(error.message);
    }
    pass('');
  },
} : {
  'the encryption key suite needs a database': async ({ pass }) => pass('skipped: no database'),
};
