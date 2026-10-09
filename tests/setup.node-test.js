import { mkdtemp, mkdir, writeFile, rm, access, readFile } from 'fs/promises';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq } from 'drizzle-orm';

/*
  Covers the first-run setup flow: it creates the first administrator exactly once, and deletes the
  setup files so it cannot be used again.

  Requires a reachable Postgres with kempo's schema applied. The create path only runs when the
  database has no administrator yet, so a populated dev database is never touched; the already-set-up
  path runs there instead. Skips when the database cannot be reached.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async rel => (await import(pathToFileURL(path.join(root, rel)).href)).default;

const db = await load('server/db/index.js');
const { user, userGroup } = await import(pathToFileURL(path.join(root, 'server/db/schema.js')).href);
const completeSetup = await load('server/utils/setup/completeSetup.js');
const hasAdmin = await load('server/utils/setup/hasAdmin.js');
const removeSetupFiles = await load('server/utils/setup/removeSetupFiles.js');
const createUser = await load('server/utils/users/createUser.js');

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const skipped = reason => ({
  'setup (SKIPPED)': async ({ pass }) => pass(`skipped: ${reason}`),
});

const makeSetupDir = async () => {
  const dir = path.join(await mkdtemp(path.join(os.tmpdir(), 'kempo-setup-')), 'setup');
  await mkdir(path.join(dir, 'api'), { recursive: true });
  await writeFile(path.join(dir, 'index.page.html'), '<page></page>');
  return dir;
};

const exists = p => access(p).then(() => true, () => false);

/*
  Runs scripts/make-admin.js the way a developer would: from inside their project, with the email
  typed at the prompt. Resolves with the exit code.
*/
const runMakeAdmin = (cwd, email) => new Promise(resolve => {
  const child = spawn(process.execPath, [path.join(root, 'scripts/make-admin.js')], { cwd, env: process.env });
  child.stdin.write(`${email}
`);
  child.on('close', resolve);
});

const noDatabaseTests = {
  'removeSetupFiles deletes the whole setup directory': async ({ pass, fail }) => {
    const dir = await makeSetupDir();
    try {
      const [error] = await removeSetupFiles({ setupDir: dir });
      if(error) return fail(error.msg);
      if(await exists(dir)) return fail('the directory should be gone');
      if(await exists(path.join(dir, 'api'))) return fail('the api route should be gone with it');
      pass('removed');
    } catch(e){ fail(e.message); } finally { await rm(path.dirname(dir), { recursive: true, force: true }); }
  },

  'removeSetupFiles succeeds when the directory is already gone': async ({ pass, fail }) => {
    const [error] = await removeSetupFiles({ setupDir: path.join(os.tmpdir(), 'kempo-setup-never-existed', 'setup') });
    if(error) return fail(error.msg);
    pass('idempotent');
  },

  'removeSetupFiles refuses without a directory': async ({ pass, fail }) => {
    const [error] = await removeSetupFiles({});
    if(error?.code !== 400) return fail(`expected 400, got ${error?.code}`);
    pass('rejected');
  },

  "init's terminal path creates the admin through completeSetup, which deletes the setup page": async ({ pass, fail }) => {
    const cli = await readFile(path.join(root, 'bin/cli.js'), 'utf8');
    if(!cli.includes("'setup', 'completeSetup.js'")) return fail('bin/cli.js must create the terminal-path admin via completeSetup');
    if(!cli.includes("join(projectDir, 'public', 'setup')")) return fail('bin/cli.js must pass public/setup as the directory to delete');
    pass('wired to completeSetup');
  },
};

const tests = {
  ...noDatabaseTests,

  'makeAdmin deletes the setup page and api, and leaves the project without them': async ({ pass, fail }) => {
    const project = await mkdtemp(path.join(os.tmpdir(), 'kempo-makeadmin-'));
    const email = 'make-admin@setup.test';
    try {
      await mkdir(path.join(project, 'public', 'setup', 'api'), { recursive: true });
      await writeFile(path.join(project, 'public', 'setup', 'api', 'POST.js'), '');

      const [createError, created] = await createUser({ name: 'Make Admin', email, password: 'longenough1' });
      if(createError) return fail(createError.msg);

      const code = await runMakeAdmin(project, email);
      if(code !== 0) return fail(`make-admin exited ${code}`);
      if(await exists(path.join(project, 'public', 'setup'))) return fail('public/setup should be deleted once makeAdmin has made an admin');

      await db.delete(userGroup).where(eq(userGroup.userId, created.user.id));
      pass('setup files removed');
    } catch(e){ fail(e.message); } finally {
      await db.delete(user).where(eq(user.email, email)).catch(() => {});
      await rm(project, { recursive: true, force: true });
    }
  },

  'a short password is rejected before anything is created': async ({ pass, fail }) => {
    const dir = await makeSetupDir();
    try {
      const [error] = await completeSetup({ name: 'A', email: 'short@setup.test', password: 'abc', setupDir: dir });
      if(error?.code !== 400) return fail(`expected 400, got ${error?.code}`);
      if(!await exists(dir)) return fail('setup files must survive a rejected attempt');
      pass('rejected');
    } catch(e){ fail(e.message); } finally { await rm(path.dirname(dir), { recursive: true, force: true }); }
  },

  'setup creates one admin then deletes its files, and refuses a second run': async ({ pass, fail }) => {
    const [checkError, adminExists] = await hasAdmin();
    if(checkError) return fail(checkError.msg);

    const dir = await makeSetupDir();
    const email = 'first-admin@setup.test';
    try {
      if(adminExists){
        const [error] = await completeSetup({ name: 'A', email, password: 'longenough1', setupDir: dir });
        if(error?.code !== 404) return fail(`expected 404 once an admin exists, got ${error?.code}`);
        if(await exists(dir)) return fail('stale setup files should be deleted when an admin already exists');
        return pass('refused and cleaned up');
      }

      const [error, result] = await completeSetup({ name: 'First Admin', email, password: 'longenough1', setupDir: dir });
      if(error) return fail(error.msg);
      if(!result.setupFilesRemoved || await exists(dir)) return fail('setup files should be deleted after success');

      const [, nowHasAdmin] = await hasAdmin();
      if(!nowHasAdmin) return fail('the new user should be an administrator');

      const [secondError] = await completeSetup({ name: 'Second', email: 'second@setup.test', password: 'longenough1', setupDir: dir });
      if(secondError?.code !== 404) return fail(`a second run must be refused, got ${secondError?.code}`);
      pass('created once, then locked');
    } catch(e){ fail(e.message); } finally {
      for(const cleanupEmail of [email, 'second@setup.test']){
        const [row] = await db.select().from(user).where(eq(user.email, cleanupEmail)).catch(() => []);
        if(!row) continue;
        await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
        await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
      }
      await rm(path.dirname(dir), { recursive: true, force: true });
    }
  },
};

export default databaseReachable ? tests : { ...noDatabaseTests, ...skipped('no reachable database') };
