/* The elements load the SDK from /kempo/sdk.js, so the cache to clear is the one in /kempo/fetch.js, not src's. */
import { post } from '/kempo/fetch.js';

/*
  Runs the real elements and the real notification client in a real browser (see scripts/run-browser-tests.js for how
  /kempo/**, /kempo-ui/** and /kempo-css/** are made available).

  Network is the one thing faked: window.fetch answers the /kempo/api/notifications routes from a small in-memory
  store, recording every request. The store follows the server's rules closely enough for what is pending, what a
  bell counts and what a list shows to change when something is viewed, acknowledged or dismissed (those rules
  themselves are tested against the real database in notification-types.node-test.js). The elements, the client,
  the SDK and kempo-ui run for real.
*/

window.kempo = { pathsToIcons: ['/kempo/icons', '/kempo-ui/icons'], pathToStylesheet: '/kempo-css/kempo.min.css' };

const realFetch = window.fetch.bind(window);
let store = [];
let calls = [];
let actionResponse = { status: 200, body: { ok: true } };
let signedIn = true;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const config = { pollSeconds: 0, cooldownSeconds: 180, toastSeconds: 1, bannerSeconds: 1 };

const statusOf = item => (item.dismissedAt ? 'dismissed' : item.acknowledgedAt ? 'acknowledged' : item.viewedAt ? 'viewed' : item.deliveredAt ? 'delivered' : 'pending');

const pendingNow = () => store.filter(item => item.type !== 'notice' && !item.dismissedAt && !item.acknowledgedAt && (item.mustAcknowledge || !item.viewedAt));

const unreadOf = type => store.filter(item => !item.viewedAt && !item.dismissedAt && (!type || item.type === type)).length;

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
  const method = (init.method || 'GET').toUpperCase();
  const body = init.body ? JSON.parse(init.body) : null;

  if(url.pathname === '/kempo/api/test/reset') return json({});

  if(url.pathname.startsWith('/kempo/api/notifications')){
    calls.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body });
    if(!signedIn) return json({ error: 'Authentication required' }, 401);

    const [, , , , id, verb] = url.pathname.split('/');
    const now = new Date().toISOString();

    if(method === 'GET' && id === 'pending') return json({ notifications: pendingNow().map(item => ({ ...item, status: statusOf(item) })), config, unreadNotices: unreadOf('notice') });
    if(method === 'GET' && id === 'count') return json({ count: unreadOf(url.searchParams.get('type')) });

    if(method === 'GET'){
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status') || 'active';
      let rows = store.filter(item => (!type || item.type === type) && (status === 'all' ? true : status === 'active' ? !item.dismissedAt : statusOf(item) === status));
      if(url.searchParams.get('unreadOnly') === 'true') rows = rows.filter(item => !item.viewedAt);
      return json({ notifications: rows.map(item => ({ ...item, status: statusOf(item) })), total: rows.length, unread: unreadOf(type), limit: 20, offset: 0 });
    }

    if(method === 'POST' && id === 'read-all'){
      store.filter(item => !item.viewedAt && !item.dismissedAt && (!body?.type || item.type === body.type)).forEach(item => { item.viewedAt = now; });
      return json({ updated: 1 });
    }
    if(method === 'POST' && id === 'delivered'){
      store.filter(item => body.ids.includes(item.id)).forEach(item => { item.deliveredAt = item.deliveredAt || now; });
      return json({ updated: body.ids.length });
    }

    const item = store.find(entry => entry.id === id);
    if(!item) return json({ error: 'Notification not found' }, 404);
    if(verb === 'shown') item.lastShownAt = now;
    if(verb === 'viewed') item.viewedAt = item.viewedAt || now;
    if(verb === 'acknowledge') item.acknowledgedAt = item.viewedAt = now;
    if(method === 'DELETE') item.dismissedAt = now;
    return json({ id });
  }

  if(url.pathname === '/kempo/api/thing/retry'){
    calls.push({ method, path: url.pathname, body });
    return json(actionResponse.body, actionResponse.status);
  }

  return realFetch(input, init);
};

/* The client starts asking the moment it loads, so it and the elements are loaded once the network is faked. */
await import('../src/kempo/components/NotificationList.js');
await import('../src/kempo/components/NotificationBell.js');
await import('../src/kempo/components/NotificationHistory.js');
await import('../src/kempo/components/NotificationInline.js');
const client = await import('/kempo/notifications/client.js');

let counter = 0;

const make = (overrides = {}) => ({
  id: `n${++counter}-${crypto.randomUUID()}`,
  owner: 'test',
  type: 'notice',
  subtype: null,
  level: 'info',
  title: 'A title',
  message: null,
  actions: [],
  priority: 0,
  mustAcknowledge: false,
  cooldownSeconds: null,
  displaySeconds: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  expiresAt: null,
  deliveredAt: null,
  viewedAt: null,
  acknowledgedAt: null,
  dismissedAt: null,
  lastShownAt: null,
  expired: false,
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

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const mount = async (tag, attributes = {}) => {
  const el = document.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value));
  document.body.appendChild(el);
  return el;
};

const mountList = async (attributes = {}) => {
  const el = await mount('k-notification-list', attributes);
  await until(() => el.loading === false && el.querySelector('[data-notification-id]') !== null || el.textContent.includes('No notifications'), 'the list to load');
  await el.updateComplete;
  return el;
};

const buttonLabelled = (el, label) => [...el.querySelectorAll('button, a')].find(node => node.textContent.trim() === label);

const called = (method, suffix) => calls.some(call => call.method === method && call.path.endsWith(suffix));

const toasts = () => [...document.querySelectorAll('k-toast')];

const bannerCards = () => [...document.querySelectorAll('[data-notification-banners] [data-notification-id]')];

const dialogs = () => [...document.querySelectorAll('k-dialog')].filter(dialog => dialog.opened);

/* The SDK keeps a read for a few seconds and a write clears it, so a change made behind its back (the store here) needs a write to be seen. */
const forgetReads = () => post('/kempo/api/test/reset', {});

export const beforeEach = async () => {
  store = [];
  calls = [];
  actionResponse = { status: 200, body: { ok: true } };
  signedIn = true;
  await forgetReads();
};

/* A banner or a modal left open would hold back the next one, so each test leaves nothing on the screen. */
export const afterEach = async () => {
  document.querySelectorAll('k-notification-list, k-notification-bell, k-notification-history, k-notification-inline').forEach(el => el.remove());
  for(let guard = 0; guard < 10; guard++){
    const banner = document.querySelector('[data-notification-banners] button[aria-label="Dismiss"]');
    const dialog = dialogs()[0]?.querySelector('button');
    if(banner) banner.click();
    else if(dialog) dialog.click();
    else break;
    await pause(60);
  }
  toasts().forEach(toast => toast.remove());
  document.querySelectorAll('k-toast-container').forEach(container => container.remove());
};

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

export default {
  /*
    The list
  */

  'a title and message containing markup are shown as text and never become elements': async ({ pass }) => {
    window.xssRan = false;
    store = [make({ title: '<img src=x onerror="window.xssRan=true">', message: '<script>window.xssRan = true</script><b>bold</b>' })];
    const el = await mountList();
    expect(!el.querySelector('img') && !el.querySelector('script') && !el.querySelector('b'), 'no element may be created from the text');
    expect(el.textContent.includes('<img src=x') && el.textContent.includes('<b>bold</b>'), 'the markup should be visible as text');
    await pause(200);
    expect(window.xssRan === false, 'no script may run');
    pass();
  },

  'an empty list says so, and an unauthenticated one asks the person to sign in': async ({ pass }) => {
    const empty = await mountList();
    expect(empty.textContent.includes('No notifications'), 'empty state');
    empty.remove();
    signedIn = false;
    await forgetReads();
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

  'an api action calls the endpoint as the person, then acknowledges the notification': async ({ pass }) => {
    store = [make({ title: 'Failed', actions: [{ label: 'Try again', api: { method: 'POST', url: '/kempo/api/thing/retry', body: { id: 7 } } }] })];
    const el = await mountList();
    buttonLabelled(el, 'Try again').click();
    await until(() => called('POST', '/acknowledge'), 'the acknowledge call');

    const retry = calls.find(call => call.path === '/kempo/api/thing/retry');
    expect(retry && retry.method === 'POST' && retry.body.id === 7, `the action should be called with its method and body, got ${JSON.stringify(retry)}`);
    expect(calls.indexOf(retry) < calls.findIndex(call => call.path.endsWith('/acknowledge')), 'acknowledging comes after the call');
    await until(() => el.textContent.includes('Done'), 'the done label');
    expect(!buttonLabelled(el, 'Try again'), 'the action goes away once acknowledged');
    pass();
  },

  'a failing api action shows the error and does not acknowledge the notification': async ({ pass }) => {
    actionResponse = { status: 403, body: { error: 'Insufficient permissions' } };
    store = [make({ actions: [{ label: 'Try again', api: { method: 'POST', url: '/kempo/api/thing/retry' } }] })];
    const el = await mountList();
    buttonLabelled(el, 'Try again').click();
    await until(() => el.querySelector('[role=alert]'), 'the error');
    expect(el.querySelector('[role=alert]').textContent.includes('Insufficient permissions'), 'the server\'s reason is shown');
    expect(!called('POST', '/acknowledge'), 'a failed action must not be recorded as acknowledged');
    expect(buttonLabelled(el, 'Try again'), 'and can be tried again');
    pass();
  },

  'marking viewed and dismissing update the list and notify listeners': async ({ pass }) => {
    store = [make({ title: 'One' }), make({ title: 'Two' })];
    const el = await mountList();
    const changes = [];
    el.addEventListener('notifications-change', event => changes.push(event.detail.unread));

    el.querySelector('button[aria-label="Mark as read"]').click();
    await until(() => changes.length && changes.at(-1) === 1, 'the unread count to drop to 1');
    expect(called('POST', '/viewed'), 'viewed route called');
    expect(el.querySelectorAll('button[aria-label="Mark as read"]').length === 1, 'only the unviewed one keeps the control');

    el.querySelector('button[aria-label="Dismiss"]').click();
    await until(() => el.querySelectorAll('[data-notification-id]').length === 1, 'the dismissed one to disappear');
    expect(called('DELETE', store[0].id) || calls.some(call => call.method === 'DELETE'), 'dismiss uses DELETE');
    pass();
  },

  'a list asks for one kind and one status, and a history shows dismissed ones without a dismiss control': async ({ pass }) => {
    store = [make({ title: 'A notice', type: 'notice' }), make({ title: 'A toast', type: 'toast' }), make({ title: 'Gone', type: 'notice', dismissedAt: new Date().toISOString() })];
    const el = await mountList({ type: 'notice', status: 'all', 'show-status': '' });
    const request = calls.find(call => call.method === 'GET' && call.path === '/kempo/api/notifications');
    expect(request.query.type === 'notice' && request.query.status === 'all', `the query carries the type and status: ${JSON.stringify(request.query)}`);
    expect(el.textContent.includes('A notice') && !el.textContent.includes('A toast'), 'only notices');
    expect(el.textContent.includes('Gone') && el.textContent.includes('Dismissed'), 'a dismissed one is in the history, named as such');
    const gone = [...el.querySelectorAll('[data-notification-id]')].find(row => row.textContent.includes('Gone'));
    expect(!gone.querySelector('button[aria-label="Dismiss"]'), 'and cannot be dismissed again');
    pass();
  },

  'the history page filters by kind and status': async ({ pass }) => {
    store = [make({ title: 'Notice one', type: 'notice' }), make({ title: 'Toast one', type: 'toast' })];
    const history = await mount('k-notification-history');
    await until(() => history.querySelector('[data-notification-id]'), 'the history to load');
    expect(history.textContent.includes('Notice one') && history.textContent.includes('Toast one'), 'everything to begin with');

    const kind = history.querySelector('#notification-history-type');
    kind.value = 'toast';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => !history.textContent.includes('Notice one') && history.textContent.includes('Toast one'), 'only toasts');
    pass();
  },

  /*
    The bell
  */

  'the bell shows the unviewed notices the client counted, and marks the notices viewed': async ({ pass }) => {
    store = [make({ type: 'notice' }), make({ type: 'notice' }), make({ type: 'notice', viewedAt: new Date().toISOString() }), make({ type: 'banner' })];
    const bell = await mount('k-notification-bell', { 'page-href': '/notifications/' });
    await client.refresh();
    await until(() => bell.querySelector('[data-unread-badge]'), 'the badge');
    expect(bell.querySelector('[data-unread-badge]').textContent.trim() === '2', 'two unviewed notices, and the banner is not one of them');
    expect(bell.querySelector('button[slot=trigger]').getAttribute('aria-label').includes('2 unread'), 'the count is announced');
    expect(bell.querySelector('a[href="/notifications/"]'), 'the View all link');

    await until(() => bell.querySelector('k-notification-list [data-notification-id]'), 'the panel list');
    expect(calls.some(call => call.path === '/kempo/api/notifications' && call.query.type === 'notice'), 'the panel asks for notices only');
    buttonLabelled(bell, 'Mark all read').click();
    await until(() => !bell.querySelector('[data-unread-badge]'), 'the badge to clear');
    const readAll = calls.find(call => call.path.endsWith('/read-all'));
    expect(readAll.body.type === 'notice', 'only the notices are marked');
    expect(store.filter(item => item.type === 'notice').every(item => item.viewedAt) && !store.find(item => item.type === 'banner').viewedAt, 'the banner was left alone');
    pass();
  },

  'the bell renders nothing when there is no one to answer for': async ({ pass }) => {
    signedIn = false;
    const bell = await mount('k-notification-bell');
    await client.refresh();
    await pause(150);
    await bell.updateComplete;
    expect(!bell.querySelector('k-dropdown'), 'no dropdown for a visitor with neither a login nor a guest');
    pass();
  },

  'opening the bell views what is on screen after a second, and closing it first does not': async ({ pass }) => {
    store = [make({ title: 'Read me' })];
    const bell = await mount('k-notification-bell');
    await client.refresh();
    await until(() => bell.count === 1, 'the count');

    const dropdown = bell.querySelector('k-dropdown');
    dropdown.dispatchEvent(new CustomEvent('opened', { bubbles: true, detail: {} }));
    await pause(300);
    dropdown.dispatchEvent(new CustomEvent('closed', { bubbles: true, detail: {} }));
    await pause(1100);
    expect(!called('POST', '/viewed'), 'closed before a second, so nothing was viewed');

    dropdown.dispatchEvent(new CustomEvent('opened', { bubbles: true, detail: {} }));
    await until(() => called('POST', '/viewed'), 'the notice to be viewed', 3000);
    pass();
  },

  /*
    The client
  */

  'a toast is shown as text, reported delivered, and counts as viewed once it has been up for its time': async ({ pass }) => {
    window.xssRan = false;
    store = [make({ type: 'toast', subtype: 'success', title: '<img src=x onerror="window.xssRan=true">Saved', displaySeconds: 1 })];
    await client.refresh();
    await until(() => toasts().length === 1, 'the toast');
    expect(!toasts()[0].querySelector('img') && toasts()[0].textContent.includes('<img src=x'), 'its text is text');
    await until(() => called('POST', '/delivered'), 'the delivery report');
    expect(!called('POST', '/viewed'), 'not viewed while it is still up');
    await until(() => called('POST', '/viewed'), 'it to be viewed after its time', 4000);
    expect(window.xssRan === false, 'nothing ran');
    pass();
  },

  'the X dismisses a toast and does not count it as viewed': async ({ pass }) => {
    store = [make({ type: 'toast', title: 'Dismiss me', displaySeconds: 30 })];
    await client.refresh();
    await until(() => toasts().length === 1, 'the toast');
    toasts()[0].shadowRoot.querySelector('#close').click();
    await until(() => calls.some(call => call.method === 'DELETE'), 'the dismissal');
    expect(!called('POST', '/viewed'), 'a dismissed toast was not viewed');
    pass();
  },

  'a toast\'s action acknowledges it, and a toast that must be acknowledged stays with an Okay': async ({ pass }) => {
    store = [make({ type: 'toast', title: 'With action', displaySeconds: 30, actions: [{ label: 'Got it', api: { method: 'POST', url: '/kempo/api/thing/retry' } }] })];
    await client.refresh();
    await until(() => toasts().length === 1, 'the first toast');
    toasts()[0].shadowRoot.querySelector('#action').click();
    await until(() => called('POST', '/acknowledge'), 'the acknowledgement');
    expect(calls.some(call => call.path === '/kempo/api/thing/retry'), 'the action was carried out first');

    calls = [];
    store = [make({ type: 'toast', title: 'Must confirm', mustAcknowledge: true })];
    await client.refresh();
    await until(() => toasts().some(toast => toast.textContent.includes('Must confirm')), 'the must-acknowledge toast');
    const toast = toasts().find(entry => entry.textContent.includes('Must confirm'));
    expect(toast.timeout === 0, 'it does not time out');
    expect(toast.textContent.includes('Okay'), 'it has an Okay');
    await until(() => called('POST', '/shown'), 'it to be reported shown, which starts its cooldown');
    toast.shadowRoot.querySelector('#action').click();
    await until(() => called('POST', '/acknowledge'), 'the Okay to acknowledge it');
    pass();
  },

  'a failing toast action keeps the toast and says why': async ({ pass }) => {
    actionResponse = { status: 500, body: { error: 'It broke' } };
    store = [make({ type: 'toast', title: 'Will fail', displaySeconds: 30, actions: [{ label: 'Try', api: { method: 'POST', url: '/kempo/api/thing/retry' } }] })];
    await client.refresh();
    await until(() => toasts().length === 1, 'the toast');
    toasts()[0].shadowRoot.querySelector('#action').click();
    await until(() => toasts().some(toast => toast.textContent.includes('It broke')), 'the error toast');
    expect(!called('POST', '/acknowledge'), 'not acknowledged');
    pass();
  },

  'a banner sits at the top of the page, one at a time, and the next one follows when the first is dismissed': async ({ pass }) => {
    store = [make({ type: 'banner', title: 'First banner', priority: 1 }), make({ type: 'banner', title: 'Second banner' })];
    await client.refresh();
    await until(() => bannerCards().length === 1, 'one banner');
    expect(bannerCards()[0].textContent.includes('First banner'), 'the higher priority is first');
    expect((document.querySelector('main') ?? document.body).firstElementChild.hasAttribute('data-notification-banners'), 'at the top of the page content');
    await until(() => called('POST', '/delivered'), 'the delivery report');

    bannerCards()[0].querySelector('button[aria-label="Dismiss"]').click();
    await until(() => bannerCards().length === 1 && bannerCards()[0].textContent.includes('Second banner'), 'the second banner');
    expect(calls.some(call => call.method === 'DELETE'), 'the first was dismissed');
    pass();
  },

  'a banner is viewed once it has been up for the banner time, and the next one then takes its place': async ({ pass }) => {
    store = [make({ type: 'banner', title: 'Viewed banner', priority: 1 }), make({ type: 'banner', title: 'Waiting banner' })];
    await client.refresh();
    await until(() => bannerCards().length === 1 && bannerCards()[0].textContent.includes('Viewed banner'), 'the first banner');
    await until(() => called('POST', '/viewed'), 'it to be viewed', 4000);
    await until(() => bannerCards().length === 1 && bannerCards()[0].textContent.includes('Waiting banner'), 'the next one to take its place');
    pass();
  },

  'a modal cannot be closed except by acknowledging it': async ({ pass }) => {
    store = [make({ type: 'modal', title: 'Terms changed', message: 'Please read them.', mustAcknowledge: true })];
    await client.refresh();
    await until(() => dialogs().length === 1, 'the modal');
    const dialog = dialogs()[0];
    expect(dialog.textContent.includes('Please read them.') && dialog.querySelector('[slot=title]')?.textContent.includes('Terms changed'), 'its text');
    expect(!dialog.closeBtn && !dialog.overlayClose && dialog.disableKeyboardClose, 'no close button, no overlay close, no Escape');
    await until(() => called('POST', '/shown'), 'it to be reported shown');

    document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27, key: 'Escape' }));
    await pause(100);
    expect(dialogs().length === 1, 'Escape does not close it');

    [...dialog.querySelectorAll('button')].find(button => button.textContent.trim() === 'Okay').click();
    await until(() => called('POST', '/acknowledge'), 'the acknowledgement');
    await until(() => dialogs().length === 0, 'the modal to close');
    pass();
  },

  'a modal comes before a banner, whatever their priority': async ({ pass }) => {
    store = [make({ type: 'banner', title: 'Low banner', priority: 100 }), make({ type: 'modal', title: 'Urgent modal', priority: -100, mustAcknowledge: true })];
    await client.refresh();
    await until(() => dialogs().length === 1, 'the modal');
    expect(bannerCards().length === 1, 'the banner is up as well, behind it');
    pass();
  },

  'a type nobody can show is left alone, and one that was subscribed to goes to its subscriber with controls': async ({ pass }) => {
    const message = make({ type: 'chat', subtype: 'afk-message', title: 'Someone wrote to you' });
    store = [message];
    await client.refresh();
    await pause(150);
    expect(!called('POST', '/delivered'), 'nobody shows chat yet, so it is not reported delivered');

    const received = [];
    const stop = client.subscribe('chat', (notification, controls) => received.push({ notification, controls }));
    await until(() => received.length === 1, 'the subscriber to be given it');
    expect(received[0].notification.subtype === 'afk-message' && received[0].notification.title === 'Someone wrote to you', 'with its subtype');
    await until(() => called('POST', '/delivered'), 'it to be reported delivered');

    await received[0].controls.viewed();
    expect(called('POST', '/viewed'), 'the subscriber reports what the person did');
    await received[0].controls.dismiss();
    expect(calls.some(call => call.method === 'DELETE'), 'including dismissing');
    stop();
    pass();
  },

  'a type that is subscribed to later is given what was already pending': async ({ pass }) => {
    store = [make({ type: 'friend', title: 'Friend request' })];
    await client.refresh();
    await pause(100);
    const received = [];
    const stop = client.subscribe('friend', notification => received.push(notification));
    await until(() => received.length === 1, 'the late subscriber to be given it');
    stop();
    pass();
  },

  'an inline notification shows where the element is, can be dismissed, and is viewed after the banner time': async ({ pass }) => {
    store = [make({ type: 'inline', subtype: 'success', title: 'Changes saved' }), make({ type: 'inline', subtype: 'error', title: 'Not saved' })];
    const errors = await mount('k-notification-inline', { subtype: 'error' });
    await client.refresh();
    await until(() => errors.querySelector('[data-notification-id]'), 'the inline message');
    expect(errors.textContent.includes('Not saved') && !errors.textContent.includes('Changes saved'), 'only the subtype it was given');
    await until(() => called('POST', '/delivered'), 'the delivery report');
    await until(() => called('POST', '/viewed'), 'it to be viewed while on screen', 5000);

    errors.querySelector('button[aria-label="Dismiss"]').click();
    await until(() => !errors.querySelector('[data-notification-id]'), 'it to go');
    expect(calls.some(call => call.method === 'DELETE'), 'dismissed on the server too');
    pass();
  },

  'a page with no inline element leaves inline notifications pending': async ({ pass }) => {
    store = [make({ type: 'inline', title: 'Nowhere to go' })];
    await client.refresh();
    await pause(200);
    expect(!called('POST', '/delivered'), `it is not delivered when nothing on the page can show it: ${JSON.stringify(calls)}`);
    pass();
  },

  'the client keeps asking: refresh finds what was raised after the first answer': async ({ pass }) => {
    await client.refresh();
    store = [make({ type: 'banner', title: 'Raised later' })];
    window.dispatchEvent(new Event('focus'));
    await pause(1100);
    await client.refresh();
    await until(() => bannerCards().some(card => card.textContent.includes('Raised later')), 'the banner raised after the first answer');
    pass();
  },
};
