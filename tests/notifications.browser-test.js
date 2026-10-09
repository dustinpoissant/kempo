import '../src/kempo/components/NotificationList.js';
import '../src/kempo/components/NotificationBell.js';

/*
  Runs the real k-notification-list and k-notification-bell elements in a real browser (see
  scripts/run-browser-tests.js for how /kempo/**, /kempo-ui/** and /kempo-css/** are made available).

  Network is the one thing faked: window.fetch answers the /kempo/api/notifications routes from a small
  in-memory store, recording every request. The elements, the SDK and kempo-ui run for real.
*/

window.kempo = { pathsToIcons: ['/kempo/icons', '/kempo-ui/icons'], pathToStylesheet: '/kempo-css/kempo.min.css' };

const realFetch = window.fetch.bind(window);
let store = [];
let calls = [];
let actionResponse = { status: 200, body: { ok: true } };
let signedIn = true;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
  const method = (init.method || 'GET').toUpperCase();
  const body = init.body ? JSON.parse(init.body) : null;

  if(url.pathname.startsWith('/kempo/api/notifications')){
    calls.push({ method, path: url.pathname, body });
    if(!signedIn) return json({ error: 'Authentication required' }, 401);
    const unread = store.filter(n => !n.readAt).length;
    if(method === 'GET' && url.pathname === '/kempo/api/notifications/count') return json({ count: unread });
    if(method === 'GET') return json({ notifications: store, total: store.length, unread, limit: 20, offset: 0 });
    const [, , , , id, verb] = url.pathname.split('/');
    const item = store.find(n => n.id === id);
    if(method === 'POST' && id === 'read-all'){
      store.forEach(n => { n.readAt = n.readAt || new Date().toISOString(); });
      return json({ updated: unread });
    }
    if(!item) return json({ error: 'Notification not found' }, 404);
    if(verb === 'read') item.readAt = item.readAt || new Date().toISOString();
    if(verb === 'handled') item.handledAt = item.readAt = new Date().toISOString();
    if(method === 'DELETE') store = store.filter(n => n !== item);
    return json({ id });
  }

  if(url.pathname === '/kempo/api/thing/retry'){
    calls.push({ method, path: url.pathname, body });
    return json(actionResponse.body, actionResponse.status);
  }

  return realFetch(input, init);
};

const make = (overrides = {}) => ({
  id: crypto.randomUUID(),
  owner: 'test',
  title: 'A title',
  message: null,
  level: 'info',
  actions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  readAt: null,
  handledAt: null,
  ...overrides
});

const until = async (condition, description, timeout = 4000) => {
  const deadline = Date.now() + timeout;
  while(Date.now() < deadline){
    if(condition()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${description}`);
};

const mount = async (tag, attributes = {}) => {
  const el = document.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value));
  document.body.appendChild(el);
  return el;
};

const mountList = async () => {
  const el = await mount('k-notification-list');
  await until(() => el.loading === false && el.querySelector('[data-notification-id]') !== null || el.textContent.includes('No notifications'), 'the list to load');
  await el.updateComplete;
  return el;
};

const buttonLabelled = (el, label) => [...el.querySelectorAll('button, a')].find(node => node.textContent.trim() === label);

export const beforeEach = () => {
  store = [];
  calls = [];
  actionResponse = { status: 200, body: { ok: true } };
  signedIn = true;
};

export const afterEach = () => {
  document.querySelectorAll('k-notification-list, k-notification-bell').forEach(el => el.remove());
};

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

export default {
  'a title and message containing markup are shown as text and never become elements': async ({ pass }) => {
    window.xssRan = false;
    store = [make({ title: '<img src=x onerror="window.xssRan=true">', message: '<script>window.xssRan = true</script><b>bold</b>' })];
    const el = await mountList();
    expect(!el.querySelector('img') && !el.querySelector('script') && !el.querySelector('b'), 'no element may be created from the text');
    expect(el.textContent.includes('<img src=x') && el.textContent.includes('<b>bold</b>'), 'the markup should be visible as text');
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(window.xssRan === false, 'no script may run');
    pass();
  },

  'an empty list says so, and an unauthenticated one asks the user to sign in': async ({ pass }) => {
    const empty = await mountList();
    expect(empty.textContent.includes('No notifications'), 'empty state');
    empty.remove();
    signedIn = false;
    const el = await mount('k-notification-list');
    await until(() => el.textContent.includes('Sign in'), 'the sign in message');
    pass();
  },

  'only links to a path on this site are rendered as actions': async ({ pass }) => {
    store = [make({ actions: [
      { label: 'Good link', href: '/admin/notifications' },
      { label: 'Script link', href: 'javascript:window.xssRan=true' },
      { label: 'Other site', href: 'https://evil.test/' },
      { label: 'Same scheme other host', href: '//evil.test/' },
      { label: 'Good call', api: { method: 'POST', url: '/kempo/api/thing/retry' } },
      { label: 'Foreign call', api: { method: 'POST', url: 'https://evil.test/x' } },
      { label: 'Get call', api: { method: 'GET', url: '/kempo/api/thing/retry' } }
    ] })];
    const el = await mountList();
    expect(buttonLabelled(el, 'Good link')?.getAttribute('href') === '/admin/notifications', 'a local link is rendered');
    expect(buttonLabelled(el, 'Good call'), 'a local call is rendered');
    for(const label of ['Script link', 'Other site', 'Same scheme other host', 'Foreign call', 'Get call']){
      expect(!buttonLabelled(el, label), `${label} must not be rendered`);
    }
    pass();
  },

  'an api action calls the endpoint as the user, then marks the notification handled': async ({ pass }) => {
    store = [make({ title: 'Failed', actions: [{ label: 'Try again', api: { method: 'POST', url: '/kempo/api/thing/retry', body: { id: 7 } } }] })];
    const el = await mountList();
    buttonLabelled(el, 'Try again').click();
    await until(() => calls.some(c => c.path.endsWith('/handled')), 'the handled call');

    const retry = calls.find(c => c.path === '/kempo/api/thing/retry');
    expect(retry && retry.method === 'POST' && retry.body.id === 7, `the action should be called with its method and body, got ${JSON.stringify(retry)}`);
    expect(calls.indexOf(retry) < calls.findIndex(c => c.path.endsWith('/handled')), 'handled comes after the call');
    await until(() => el.textContent.includes('Done'), 'the done label');
    expect(!buttonLabelled(el, 'Try again'), 'the action goes away once handled');
    pass();
  },

  'a failing api action shows the error and does not mark the notification handled': async ({ pass }) => {
    actionResponse = { status: 403, body: { error: 'Insufficient permissions' } };
    store = [make({ actions: [{ label: 'Try again', api: { method: 'POST', url: '/kempo/api/thing/retry' } }] })];
    const el = await mountList();
    buttonLabelled(el, 'Try again').click();
    await until(() => el.querySelector('[role=alert]'), 'the error');
    expect(el.querySelector('[role=alert]').textContent.includes('Insufficient permissions'), 'the server\'s reason is shown');
    expect(!calls.some(c => c.path.endsWith('/handled')), 'a failed action must not be recorded as handled');
    expect(buttonLabelled(el, 'Try again'), 'and can be tried again');
    pass();
  },

  'marking read and dismissing update the list and notify listeners': async ({ pass }) => {
    store = [make({ title: 'One' }), make({ title: 'Two' })];
    const el = await mountList();
    const changes = [];
    el.addEventListener('notifications-change', event => changes.push(event.detail.unread));

    el.querySelector('button[aria-label="Mark as read"]').click();
    await until(() => changes.length && changes.at(-1) === 1, 'the unread count to drop to 1');
    expect(calls.some(c => c.method === 'POST' && c.path.endsWith('/read')), 'read route called');
    expect(el.querySelectorAll('button[aria-label="Mark as read"]').length === 1, 'only the unread one keeps the control');

    el.querySelector('button[aria-label="Dismiss"]').click();
    await until(() => el.querySelectorAll('[data-notification-id]').length === 1, 'the dismissed one to disappear');
    expect(calls.some(c => c.method === 'DELETE'), 'dismiss uses DELETE');
    pass();
  },

  'the bell shows the unread count, updates it from the list, and marks everything read': async ({ pass }) => {
    store = [make(), make(), make({ readAt: new Date().toISOString() })];
    const bell = await mount('k-notification-bell', { interval: '0', 'page-href': '/admin/notifications' });
    await until(() => bell.querySelector('[data-unread-badge]'), 'the badge');
    expect(bell.querySelector('[data-unread-badge]').textContent.trim() === '2', 'two unread');
    expect(bell.querySelector('button[slot=trigger]').getAttribute('aria-label').includes('2 unread'), 'the count is announced');
    expect(bell.querySelector('a[href="/admin/notifications"]'), 'the View all link');

    await until(() => bell.querySelector('k-notification-list [data-notification-id]'), 'the panel list');
    buttonLabelled(bell, 'Mark all read').click();
    await until(() => !bell.querySelector('[data-unread-badge]'), 'the badge to clear');
    expect(store.every(n => n.readAt), 'everything was marked read');
    pass();
  },

  'the bell renders nothing when nobody is signed in': async ({ pass }) => {
    signedIn = false;
    const bell = await mount('k-notification-bell', { interval: '0' });
    await until(() => bell.signedOut === true, 'the signed out state');
    await bell.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(!bell.querySelector('k-dropdown'), 'no dropdown for a signed out visitor');
    pass();
  },

  'the bell refreshes its count when the window regains focus': async ({ pass }) => {
    store = [make()];
    const bell = await mount('k-notification-bell', { interval: '0' });
    await until(() => bell.count === 1, 'the first count');
    store.push(make(), make());
    window.dispatchEvent(new Event('focus'));
    await until(() => bell.count === 3, 'the count to refresh on focus');
    pass();
  },
};
