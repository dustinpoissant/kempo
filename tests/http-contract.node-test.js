import { spawn, execFileSync } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, eq } from 'drizzle-orm';

/*
  Drives a real server over HTTP and asserts who is allowed to reach what.

  This is the shape of the bugs that hurt most here. The middleware:before_page guard was wired
  into two of six render paths, so a private page answered 200 to anonymous requests while the
  equivalent file-backed route correctly answered 404 — a difference nothing but an HTTP-level
  check would notice. Permission boundaries have no unit-testable seam either: they only exist as
  the combination of routing, session lookup and permission lookup.

  Requires a reachable Postgres. Skips itself with a clear message when there is none, so a
  checkout without one still runs `npm test`.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const db = (await import(pathToFileURL(path.join(root, 'server/db/index.js')).href)).default;
const { user, userGroup, session } = await import(pathToFileURL(path.join(root, 'server/db/schema.js')).href);
const createUser = (await import(pathToFileURL(path.join(root, 'server/utils/users/createUser.js')).href)).default;
const addUserToGroup = (await import(pathToFileURL(path.join(root, 'server/utils/groups/addUserToGroup.js')).href)).default;

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const ADMIN = { name: 'Contract Admin', email: 'contract-admin@test.local', password: 'ContractAdmin123!' };
const MEMBER = { name: 'Contract Member', email: 'contract-member@test.local', password: 'ContractMember123!' };

const state = { server: null, port: null, tmp: null, cookies: {} };

const purgeUsers = async () => {
  for(const email of [ADMIN.email, MEMBER.email]){
    const [row] = await db.select().from(user).where(eq(user.email, email));
    if(!row) continue;
    await db.delete(session).where(eq(session.userId, row.id)).catch(() => {});
    await db.delete(userGroup).where(eq(userGroup.userId, row.id)).catch(() => {});
    await db.delete(user).where(eq(user.id, row.id)).catch(() => {});
  }
};

const randomPort = () => 10000 + Math.floor(Math.random() * 20000);

const waitForServer = async port => {
  for(let i = 0; i < 100; i++){
    try {
      await fetch(`http://127.0.0.1:${port}/login`);
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return false;
};

/*
  Requests never follow redirects: a 302 to /login is the assertion for "not allowed", and
  following it would turn every rejection into a 200.
*/
const request = async (method, urlPath, as) => {
  const headers = {};
  if(as && state.cookies[as]) headers.cookie = `session_token=${state.cookies[as]}`;
  try {
    const res = await fetch(`http://127.0.0.1:${state.port}${urlPath}`, {
      method,
      headers,
      redirect: 'manual',
      // A route that never responds is a defect worth naming, not a reason to hang the suite
      signal: AbortSignal.timeout(5000),
    });
    return res.status;
  } catch(e) {
    return e.name === 'TimeoutError' ? 'no response within 5s' : `request failed: ${e.message}`;
  }
};

const login = async ({ email, password }) => {
  const res = await fetch(`http://127.0.0.1:${state.port}/kempo/api/auth/login/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  const cookie = res.headers.get('set-cookie') || '';
  return cookie.match(/session_token=([^;]+)/)?.[1] || null;
};

/*
  (method, path, who, expected status). `null` means no session at all.

  Each row is a boundary someone could quietly move: the redirect-to-login rows are the auth gate,
  the 403 rows are permission checks on the API, and the 200 rows exist so a change that locks
  everything down also fails rather than looking like a pass.
*/
const CONTRACT = [
  ['GET', '/', null, 200],
  ['GET', '/login', null, 200],
  ['GET', '/register', null, 200],

  ['GET', '/account', null, 302],
  ['GET', '/account', 'member', 200],
  ['GET', '/account', 'admin', 200],

  // Requires system:admin:access, which only the Administrators group grants
  ['GET', '/admin', null, 302],
  ['GET', '/admin', 'member', 302],
  ['GET', '/admin', 'admin', 200],

  ['GET', '/admin/accounts/users', null, 302],
  ['GET', '/admin/accounts/users', 'member', 302],
  ['GET', '/admin/accounts/users', 'admin', 200],

  ['GET', '/admin/settings', 'member', 302],
  ['GET', '/admin/settings', 'admin', 200],

  /*
    API permission checks are independent of the page gate above, and separate 401 from 403: no
    cookie or a cookie matching no session means authenticate and retry, while a valid session
    lacking the permission means retrying will not help.
  */
  ['GET', '/kempo/api/user', null, 401],
  ['GET', '/kempo/api/user', 'invalid', 401],
  ['GET', '/kempo/api/user', 'member', 403],
  ['GET', '/kempo/api/user', 'admin', 200],

  ['GET', '/kempo/api/admin-globals', null, 401],
  ['GET', '/kempo/api/admin-globals', 'invalid', 401],
  ['GET', '/kempo/api/admin-globals', 'member', 403],
  ['GET', '/kempo/api/admin-globals', 'admin', 200],

  ['GET', '/kempo/api/auth/session', null, 200],
  ['GET', '/kempo/api/settings/public', null, 200],

  ['GET', '/does-not-exist', null, 404],
];

const skipped = reason => ({
  'http contract (SKIPPED)': async ({ pass }) => pass(`skipped: ${reason}`),
});

const buildTests = () => ({
  'a server boots and both fixture accounts can sign in': async ({ pass, fail }) => {
    await purgeUsers();

    /*
      Seeds the system permissions and groups this suite depends on — system:Administrators and the
      system:admin:access it grants. Idempotent, and run here rather than as a CI step so the suite
      needs nothing but a database with the schema applied. It calls process.exit, hence a
      subprocess rather than an import.
    */
    try {
      execFileSync(process.execPath, [path.join(root, 'scripts', 'init-db.js')], { cwd: root, stdio: 'ignore' });
    } catch(e) {
      return fail(`could not seed system groups and permissions: ${e.message}`);
    }

    const [adminErr, adminResult] = await createUser({ ...ADMIN, emailVerified: true });
    if(adminErr) return fail(`could not create admin fixture: ${adminErr.msg}`);
    const [groupErr] = await addUserToGroup(adminResult.user.id, 'system:Administrators');
    if(groupErr) return fail(`could not grant admin: ${groupErr.msg}`);

    const [memberErr] = await createUser({ ...MEMBER, emailVerified: true });
    if(memberErr) return fail(`could not create member fixture: ${memberErr.msg}`);

    state.tmp = path.join(root, 'tests', '.tmp-contract');
    await mkdir(state.tmp, { recursive: true });
    /*
      Paths inside the config resolve against the server root (app-public/), not the config file's
      own directory. The two normally coincide because the config usually lives inside the root.
    */
    await writeFile(path.join(state.tmp, 'contract.config.json'), JSON.stringify({
      customRoutes: { '/kempo/**': '../dist/kempo/**' },
      middleware: { custom: ['../middleware/kempo.js'] },
      templating: { ssr: true, ssrPriority: true, preRender: false },
    }, null, 2));

    state.port = randomPort();
    state.server = spawn(process.execPath, [
      path.join(root, 'node_modules', 'kempo-server', 'dist', 'index.js'),
      '--root', path.join(root, 'app-public'),
      '--config', path.join(state.tmp, 'contract.config.json'),
      '--port', String(state.port),
    ], { cwd: root, stdio: 'ignore' });

    if(!await waitForServer(state.port)) return fail(`server did not start on port ${state.port}`);

    // A syntactically plausible token that matches no session
    state.cookies.invalid = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    state.cookies.admin = await login(ADMIN);
    state.cookies.member = await login(MEMBER);
    if(!state.cookies.admin) return fail('admin could not sign in');
    if(!state.cookies.member) return fail('member could not sign in');
    pass();
  },

  'every route answers the status its audience should see': async ({ pass, fail }) => {
    if(!state.port) return fail('server did not start');

    const failures = [];
    for(const [method, urlPath, as, expected] of CONTRACT){
      const actual = await request(method, urlPath, as);
      if(actual !== expected){
        failures.push(`${method} ${urlPath}  as ${as ?? 'anonymous'}  expected ${expected}, got ${actual}`);
      }
    }
    if(failures.length){
      return fail(`routes answering the wrong status:\n    ${failures.join('\n    ')}`);
    }
    pass(`${CONTRACT.length} route/audience combinations`);
  },

  'a signed-out session is rejected once its cookie is revoked': async ({ pass, fail }) => {
    if(!state.port) return fail('server did not start');

    const before = await request('GET', '/admin', 'admin');
    if(before !== 200) return fail(`admin should reach /admin before logout, got ${before}`);

    await db.delete(session).where(eq(session.token, state.cookies.admin));

    const after = await request('GET', '/admin', 'admin');
    if(after !== 302) return fail(`a revoked session should be redirected, got ${after}`);

    state.server?.kill();
    await rm(state.tmp, { recursive: true, force: true }).catch(() => {});
    await purgeUsers();
    pass();
  },
});

export default databaseReachable
  ? buildTests()
  : skipped('no reachable database — set DATABASE_URL to a Postgres with kempo\'s schema applied (npx drizzle-kit push)');
