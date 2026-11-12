import path from 'path';
import crypto from 'crypto';
import { tmpdir } from 'os';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { reachable, seedDatabase } from './helpers/db.js';

/*
  A page restricts itself in its frontmatter: `require-login`, `require-permissions` (with || && and parentheses) and
  `permission-denied-redirect`. The expression is checked on its own, then the whole decision against a real database.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));

const evaluate = (await load('server/utils/permissions/evaluatePermissionExpression.js')).default;
const checkPageAccess = (await load('server/utils/pages/checkPageAccess.js')).default;
const parseFrontmatter = (await load('server/utils/fs/parseFrontmatter.js')).default;
const { renderGuardedPage } = await load('middleware/kempo.js');
const db = (await load('server/db/index.js')).default;
const sdk = await load('server/sdk.js');
const addPermissionToGroup = (await load('server/utils/permissions/addPermissionToGroup.js')).default;

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const check = (expression, permissions, isAdmin = false) => {
  const [error, result] = evaluate({ expression, permissions, isAdmin });
  if(error) throw new Error(`"${expression}" failed: ${error.msg}`);
  return result;
};

const expressionTests = {
  'a single name is true when it is held': async ({ pass }) => {
    expect(check('a:b:c', ['a:b:c']), 'held');
    expect(!check('a:b:c', ['x']), 'not held');
    expect(check('my-ext.read', ['my-ext.read']), 'names may hold dashes and dots');
    pass();
  },

  '&& needs both, || needs either': async ({ pass }) => {
    expect(check('a && b', ['a', 'b']), 'both held');
    expect(!check('a && b', ['a']), 'one of two');
    expect(check('a || b', ['b']), 'either');
    expect(!check('a || b', ['c']), 'neither');
    pass();
  },

  '&& binds tighter than ||, and parentheses change the order': async ({ pass }) => {
    expect(check('a || b && c', ['a']), 'a || (b && c) with only a');
    expect(!check('a || b && c', ['b']), 'a || (b && c) with only b');
    expect(!check('(a || b) && c', ['a']), '(a || b) && c with only a');
    expect(check('(a || b) && c', ['b', 'c']), '(a || b) && c with b and c');
    expect(check('permissionA || (permissionB && permissionC)', ['permissionB', 'permissionC']), 'the example from the docs');
    expect(!check('permissionA || (permissionB && permissionC)', ['permissionB']), 'the example from the docs, B only');
    expect(check(' ( ( a ) ) ', ['a']), 'nested parentheses and spaces');
    pass();
  },

  'an administrator holds every permission': async ({ pass }) => {
    expect(check('a && (b || c)', [], true), 'admin');
    pass();
  },

  'a bad expression is an error, never true': async ({ pass }) => {
    for(const bad of ['', '   ', 'a &&', '|| a', 'a b', '(a', 'a)', '()', 'a | b', 'a & b', 'a && || b']){
      const [error, result] = evaluate({ expression: bad, permissions: ['a', 'b'] });
      expect(error && result === null, `"${bad}" should be refused`);
    }
    pass();
  },
};

/*
  The database part.
*/
const databaseReachable = await reachable(db);
if(databaseReachable) await seedDatabase();

const state = { users: [], groups: [], permissions: [], tokens: [] };

const suffix = () => crypto.randomBytes(4).toString('hex');

const makeUserWith = async permissionNames => {
  const [userError, created] = await sdk.createUser({ name: 'Access Test', email: `page-access-${suffix()}@example.com`, password: 'a-password-nobody-guesses', emailVerified: true });
  if(userError) throw new Error(userError.msg);
  state.users.push(created.user.id);

  if(permissionNames.length){
    const [groupError, group] = await sdk.createGroup({ name: `access-${suffix()}`, description: 'test', owner: 'admin' });
    if(groupError) throw new Error(groupError.msg);
    state.groups.push(group.name);
    for(const resource of permissionNames){
      const [permissionError, permission] = await sdk.createPermission({ resource: `access${suffix()}`, action: resource, description: 'test', owner: 'admin' });
      if(permissionError) throw new Error(permissionError.msg);
      state.permissions.push(permission.name);
      await addPermissionToGroup(group.name, permission.name);
      state.names[resource] = permission.name;
    }
    await sdk.addUserToGroup(created.user.id, group.name);
  }

  const [sessionError, made] = await sdk.createSession(created.user.id);
  if(sessionError) throw new Error(sessionError.msg);
  return made.token || made.sessionToken || made.session?.token;
};

const cleanUp = async () => {
  for(const name of state.permissions) await sdk.deletePermission(name);
  for(const name of state.groups) await sdk.deleteGroup(name);
  for(const id of state.users) await sdk.deleteUser(id);
  state.users = [];
  state.groups = [];
  state.permissions = [];
  state.names = {};
};

state.names = {};

/*
  Renders a page through the middleware's own guard with a stand-in request and response, from a temporary public
  directory. `render(name, frontmatter, { token, url, cookies })` answers what was sent.
*/
const MARKER = 'ONLY-FOR-THE-ALLOWED';

const withPages = async run => {
  const dir = await mkdtemp(path.join(tmpdir(), 'kempo-page-access-'));
  await writeFile(path.join(dir, 'default.template.html'), '<html><body><location /></body></html>');
  try {
    await run(async (name, frontmatter, { token, url = '/members', cookies = token ? { session_token: token } : {} } = {}) => {
      const lines = Object.entries(frontmatter).map(([key, value]) => `  ${key}: ${value}`).join('\n');
      await writeFile(path.join(dir, `${name}.page.html`), `<!--\n${lines}\n-->\n<page title="Test">\n<content>\n<h1>${MARKER}</h1>\n</content>\n</page>\n`);
      const sent = { status: null, headers: {}, body: '', redirect: null };
      const response = {
        writeHead: (status, headers = {}) => { sent.status = status; sent.headers = headers; },
        end: (body = '') => { sent.body = body; },
        redirect: location => { sent.status = 302; sent.redirect = location; },
      };
      await renderGuardedPage(path.join(dir, `${name}.page.html`), { url, query: {}, cookies }, response, dir, dir);
      return sent;
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const databaseTests = () => ({
  'a page with none of the keys is open and never reads the database': async ({ pass }) => {
    const [error, access] = await checkPageAccess({ token: null, meta: { title: 'Plain' } });
    expect(!error && access.allowed, 'a plain page should be allowed');
    pass();
  },

  'require-login lets a signed-in person in and sends everyone else to sign in': async ({ pass }) => {
    const token = await makeUserWith([]);
    const [, anonymous] = await checkPageAccess({ token: null, meta: { 'require-login': 'true' } });
    expect(!anonymous.allowed && anonymous.reason === 'login', 'no session means sign in');
    const [, stale] = await checkPageAccess({ token: 'not-a-session', meta: { 'require-login': 'true' } });
    expect(!stale.allowed && stale.reason === 'login', 'an unknown session means sign in');
    const [, custom] = await checkPageAccess({ token: null, meta: { 'require-login': 'true', 'login-required-redirect': '/members-login' } });
    expect(!custom.allowed && custom.redirect === '/members-login', 'a page can name its own sign-in page');
    expect(anonymous.redirect === null, 'no redirect means the default login page');
    const [, member] = await checkPageAccess({ token, meta: { 'require-login': 'true' } });
    expect(member.allowed, 'a signed-in person is allowed');
    const [, ignored] = await checkPageAccess({ token: null, meta: { 'require-login': 'false' } });
    expect(ignored.allowed, 'only "true" turns it on');
    await cleanUp();
    pass();
  },

  'require-permissions checks the expression against the person\'s permissions': async ({ pass }) => {
    const token = await makeUserWith(['one', 'two']);
    const { one, two } = state.names;
    const meta = expression => ({ 'require-permissions': expression, 'permission-denied-redirect': '/denied' });

    const [bothError, both] = await checkPageAccess({ token, meta: meta(`${one} && ${two}`) });
    expect(!bothError, `error: ${bothError?.msg} for ${one} / ${two}`);
    expect(both.allowed, 'holds both');
    const [, grouped] = await checkPageAccess({ token, meta: meta(`missing || (${one} && ${two})`) });
    expect(grouped.allowed, 'parentheses are honoured');
    const [, denied] = await checkPageAccess({ token, meta: meta(`${one} && missing`) });
    expect(!denied.allowed && denied.reason === 'permission' && denied.redirect === '/denied', 'a missing permission is denied with the redirect');
    const [, noRedirect] = await checkPageAccess({ token, meta: { 'require-permissions': 'missing' } });
    expect(!noRedirect.allowed && noRedirect.redirect === null, 'no redirect when none is set');
    const [, anonymous] = await checkPageAccess({ token: null, meta: meta(one) });
    expect(!anonymous.allowed && anonymous.reason === 'login', 'not signed in is sign in, not the denied redirect');
    await cleanUp();
    pass();
  },

  'an administrator passes any expression, and a bad expression is an error': async ({ pass }) => {
    const token = await makeUserWith([]);
    const [, session] = await sdk.getSession({ token });
    await sdk.addUserToGroup(session.user.id, 'system:Administrators');
    const [, admin] = await checkPageAccess({ token, meta: { 'require-permissions': 'nothing:at:all && other' } });
    expect(admin.allowed, 'administrators hold every permission');
    const [error, result] = await checkPageAccess({ token, meta: { 'require-permissions': 'a &&' } });
    expect(error && result === null, 'an unreadable expression must not allow the page');
    await cleanUp();
    pass();
  },

  'a restricted page sends a visitor who is not signed in to sign in, with a way back, or to its own page': async ({ pass }) => {
    await withPages(async render => {
      const anonymous = await render('members', { 'require-login': 'true' }, { url: '/members/area?tab=2' });
      expect(anonymous.status === 302 && anonymous.redirect === '/login?next=%2Fmembers%2Farea%3Ftab%3D2', `expected the login page with ?next=, got ${anonymous.status} ${anonymous.redirect}`);
      expect(!anonymous.body.includes(MARKER), 'the page must not be rendered for them');

      const custom = await render('members', { 'require-login': 'true', 'login-required-redirect': '/members-login' });
      expect(custom.redirect === '/members-login', `expected the page's own sign-in page, got ${custom.redirect}`);

      const stale = await render('members', { 'require-login': 'true' }, { token: 'not-a-session' });
      expect(stale.status === 302 && stale.redirect.startsWith('/login?next='), 'an unknown session is not signed in');

      const noCookies = await render('members', { 'require-login': 'true' }, { cookies: null });
      expect(noCookies.status === 302, 'a request with no cookies at all is not signed in');
    });
    pass();
  },

  'a signed-in visitor gets a restricted page, and it is never cached': async ({ pass }) => {
    const token = await makeUserWith([]);
    await withPages(async render => {
      const member = await render('members', { 'require-login': 'true' }, { token });
      expect(member.status === 200 && member.body.includes(MARKER), `a signed-in visitor should get the page, got ${member.status}`);
      expect(member.headers['Cache-Control'] === 'private, no-store', 'a restricted page must not be cached');

      const open = await render('open', { title: 'Open' });
      expect(open.status === 200 && open.body.includes(MARKER), 'a page without the keys is served as before');
      expect(!('Cache-Control' in open.headers), 'a page without the keys keeps its caching');
    });
    await cleanUp();
    pass();
  },

  'a page restricted by permissions redirects, refuses or serves by what the visitor holds': async ({ pass }) => {
    const token = await makeUserWith(['one']);
    const { one } = state.names;
    await withPages(async render => {
      const allowed = await render('p', { 'require-permissions': `missing || ${one}`, 'permission-denied-redirect': '/upgrade' }, { token });
      expect(allowed.status === 200 && allowed.body.includes(MARKER), 'holding one side of an || is enough');

      const redirected = await render('p', { 'require-permissions': `${one} && missing`, 'permission-denied-redirect': '/upgrade' }, { token });
      expect(redirected.status === 302 && redirected.redirect === '/upgrade', `expected the denied redirect, got ${redirected.status} ${redirected.redirect}`);
      expect(!redirected.body.includes(MARKER), 'the page must not be rendered for them');

      const refused = await render('p', { 'require-permissions': 'missing' }, { token });
      expect(refused.status === 403 && refused.body === '', `with no redirect they get an empty 403, got ${refused.status}`);

      const anonymous = await render('p', { 'require-permissions': one, 'permission-denied-redirect': '/upgrade' });
      expect(anonymous.redirect.startsWith('/login?next='), 'not signed in goes to sign in, not to the denied redirect');

      const [, session] = await sdk.getSession({ token });
      await sdk.addUserToGroup(session.user.id, 'system:Administrators');
      const admin = await render('p', { 'require-permissions': 'missing && other' }, { token });
      expect(admin.status === 200, 'administrators pass every expression');
    });
    await cleanUp();
    pass();
  },

  'a page whose expression cannot be read is refused and logged, never shown': async ({ pass }) => {
    const token = await makeUserWith([]);
    const logged = [];
    const originalError = console.error;
    console.error = (...args) => logged.push(args.join(' '));
    try {
      await withPages(async render => {
        const broken = await render('p', { 'require-permissions': 'a &&' }, { token });
        expect(broken.status === 500 && broken.body === '', `expected an empty 500, got ${broken.status}`);
        expect(!broken.body.includes(MARKER), 'the page must not be shown');
      });
    } finally {
      console.error = originalError;
    }
    expect(logged.some(line => line.includes('Cannot check access')), 'the problem should be logged');
    await cleanUp();
    pass();
  },

  'frontmatter values are read from the comment at the top of a page': async ({ pass }) => {
    const meta = parseFrontmatter('<!--\n  title: Members\n  require-login: true\n  require-permissions: a || (b && c)\n  permission-denied-redirect: /upgrade\n-->\n<page></page>');
    expect(meta['require-login'] === 'true', 'require-login');
    expect(meta['require-permissions'] === 'a || (b && c)', 'require-permissions keeps its operators');
    expect(meta['permission-denied-redirect'] === '/upgrade', 'permission-denied-redirect');
    pass();
  },
});

export default {
  ...expressionTests,
  ...(databaseReachable
    ? databaseTests()
    : { 'page access against the database (SKIPPED)': async ({ pass }) => pass('skipped: no reachable database') })
};
