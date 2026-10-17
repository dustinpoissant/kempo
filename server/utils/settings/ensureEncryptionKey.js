import { readFile, writeFile, chmod } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import db from '../../db/index.js';
import { setting } from '../../db/schema.js';

/*
  Makes sure SETTINGS_ENCRYPTION_KEY exists before anything needs it, so a site never has to set one up by
  hand. In order:

    1. the environment, when it has one (a secret manager, docker compose, the host). It always wins
    2. the site's `.env` file, for a key written after the process started
    3. a new random key, but only when nothing is encrypted yet. Written to `.env` (owner-only, and a
       .gitignore that names it is kept honest), then set for this process, so there is no restart

  A key is never generated while the database already holds encrypted settings: a new one would make every
  one of them unreadable. That case is an error that says so. A key is also never kept only in memory:
  when `.env` cannot be written the answer is an error, because a key that vanishes on the next restart
  is worse than none.

  Anyone with shell access to the server can read the key in `.env`. Back it up with the database: losing
  it makes the stored credentials unrecoverable (they can be typed in again, nothing else is lost).
*/

const NAME = 'SETTINGS_ENCRYPTION_KEY';
const VALID = /^[0-9a-fA-F]{64}$/;
const LINE = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${NAME}[ \\t]*=[ \\t]*(.*?)[ \\t]*$`, 'm');
const COMMENT = '# Encrypts the API credentials saved in the admin. Back this up with your database: if it is lost they cannot be recovered.';

const unquote = value => value.replace(/^(['"])(.*)\1$/, '$2');

const readText = async path => {
  try {
    return await readFile(path, 'utf8');
  } catch(error) {
    if(error.code === 'ENOENT') return null;
    throw error;
  }
};

/* How many settings are stored encrypted. A site that has not created its tables yet has none. */
const storedSecrets = async () => {
  try {
    const [{ total }] = await db.select({ total: sql`count(*)::int` }).from(setting)
      .where(and(eq(setting.type, 'secret'), isNotNull(setting.value), ne(setting.value, '')));
    return [null, total];
  } catch(error) {
    if((error?.code || error?.cause?.code) === '42P01') return [null, 0];
    return [{ code: 500, msg: 'Could not check whether this site already has encrypted settings, so no encryption key was created' }, null];
  }
};

/* Puts the key in `.env`: replaces an empty `SETTINGS_ENCRYPTION_KEY=` line, or adds one. */
const saveKey = async (path, key, text) => {
  const line = `${NAME}=${key}`;
  let next;
  if(text === null) next = `${COMMENT}\n${line}\n`;
  else if(LINE.test(text)) next = text.replace(LINE, line);
  else next = `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}\n${COMMENT}\n${line}\n`;
  await writeFile(path, next, { mode: 0o600 });
  await chmod(path, 0o600).catch(() => {});
};

/* A .gitignore that exists but does not name `.env` would let the key be committed. */
const keepOutOfGit = async dir => {
  const path = join(dir, '.gitignore');
  try {
    const text = await readText(path);
    if(text === null || /^\/?\.env\s*$/m.test(text)) return;
    await writeFile(path, `${text}${text.endsWith('\n') ? '' : '\n'}.env\n`);
  } catch {
    /* Not being able to tidy .gitignore is not worth refusing a key over. */
  }
};

const resolve = async ({ cwd }) => {
  const fromEnvironment = process.env[NAME];
  if(fromEnvironment){
    return VALID.test(fromEnvironment)
      ? [null, { source: 'environment' }]
      : [{ code: 500, msg: `${NAME} must be a 64-character hex string (32 bytes). Remove it to have one generated, or replace it with the key this site was created with` }, null];
  }

  const path = join(cwd, '.env');
  let text;
  try {
    text = await readText(path);
  } catch(error) {
    return [{ code: 500, msg: `Could not read ${path} (${error.code ?? error.message}), so no encryption key was created` }, null];
  }

  const inFile = text === null ? '' : unquote(LINE.exec(text)?.[1] ?? '');
  if(inFile){
    if(!VALID.test(inFile)) return [{ code: 500, msg: `${NAME} in ${path} must be a 64-character hex string (32 bytes)` }, null];
    process.env[NAME] = inFile;
    return [null, { source: 'file', path }];
  }

  const [countError, count] = await storedSecrets();
  if(countError) return [countError, null];
  if(count > 0){
    return [{ code: 500, msg: `This site has ${count} encrypted setting${count === 1 ? '' : 's'} but ${NAME} is not set. Restore the key it was created with (your .env backup, or the host's environment). A new key would make them unreadable` }, null];
  }

  const key = crypto.randomBytes(32).toString('hex');
  try {
    await saveKey(path, key, text);
  } catch(error) {
    return [{ code: 500, msg: `Could not save a new ${NAME} to ${path} (${error.code ?? error.message}). Set ${NAME} in the server's environment instead` }, null];
  }
  await keepOutOfGit(cwd);
  process.env[NAME] = key;
  console.warn(`[kempo] ${NAME} was not set, so one was generated and saved to ${path}. Back it up with your database: if it is lost, stored credentials (Stripe keys and the like) cannot be recovered and must be entered again.`);
  return [null, { source: 'generated', path }];
};

/* One answer per process: concurrent callers share the work, and a failure can be tried again. */
let pending = null;

export const ensureEncryptionKey = ({ cwd = process.cwd() } = {}) => {
  pending ??= resolve({ cwd }).then(result => {
    if(result[0]) pending = null;
    return result;
  });
  return pending;
};

/* For tests: forget the answer so the next call decides again. */
export const resetEncryptionKey = () => {
  pending = null;
};
