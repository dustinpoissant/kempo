import '../src/kempo/components/Permission.js';
import { post } from '../src/kempo/fetch.js';

/*
  Runs the real k-permission element in a real browser (see scripts/run-browser-tests.js for how /kempo/**, /kempo-ui/**
  and /kempo-css/** are made available). Only the network is faked: window.fetch answers the session and permission routes,
  recording every request. The element, the SDK's request sharing and kempo-ui run for real.
*/

const realFetch = window.fetch.bind(window);
let calls = [];
let signedIn = true;
let holdsPermission = true;
let sessionStatus = 200;
let sessionDelay = 0;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
  const method = (init.method || 'GET').toUpperCase();

  if(url.pathname === '/kempo/api/test/reset') return json({});

  if(url.pathname === '/kempo/api/auth/session'){
    calls.push(url.pathname);
    if(sessionDelay) await new Promise(resolve => setTimeout(resolve, sessionDelay));
    if(sessionStatus !== 200) return json({ error: 'broken' }, sessionStatus);
    return json(signedIn ? { session: { id: 's' }, user: { id: 'u', name: 'Test' } } : { session: null, user: null });
  }

  if(url.pathname === '/kempo/api/user/current/permissions'){
    calls.push(url.pathname);
    return json({ hasPermission: holdsPermission });
  }

  return realFetch(input, init);
};

const until = async (condition, description, timeout = 4000) => {
  const deadline = Date.now() + timeout;
  while(Date.now() < deadline){
    if(condition()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${description}`);
};

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const mount = (attributes = {}) => {
  const el = document.createElement('k-permission');
  Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value));
  el.innerHTML = '<p data-inside>Inside</p>';
  document.body.appendChild(el);
  return el;
};

const settled = async el => {
  await until(() => el.loading === false, 'the check to finish');
  await el.updateComplete;
};

const shown = el => !!el.querySelector('[data-inside]').assignedSlot;

export const beforeEach = async () => {
  signedIn = true;
  holdsPermission = true;
  sessionStatus = 200;
  sessionDelay = 0;
  /* A write clears the SDK's few-second read cache, so each test asks the (fake) server again. */
  await post('/kempo/api/test/reset', {});
  calls = [];
};

export const afterEach = () => {
  document.querySelectorAll('k-permission').forEach(el => el.remove());
};

export default {
  'logged-in shows what is inside to a signed-in visitor': async ({ pass }) => {
    const el = mount({ 'logged-in': '' });
    await settled(el);
    expect(shown(el), 'the content should be shown');
    pass();
  },

  'logged-in shows nothing to a visitor who is not signed in': async ({ pass }) => {
    signedIn = false;
    const el = mount({ 'logged-in': '' });
    await settled(el);
    expect(!shown(el), 'the content must stay hidden');
    pass();
  },

  'nothing is shown until the answer is known': async ({ pass }) => {
    sessionDelay = 150;
    const el = mount({ 'logged-in': '' });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(el.loading === true && !el.shadowRoot.querySelector('slot'), 'while it asks, nothing is slotted');
    await settled(el);
    expect(shown(el), 'once the answer is yes, it is shown');
    pass();
  },

  'a failed session request hides the content': async ({ pass }) => {
    sessionStatus = 500;
    const el = mount({ 'logged-in': '' });
    await settled(el);
    expect(!shown(el), 'an error is not a yes');
    pass();
  },

  'logged-in with a permission needs both, and does not ask about permissions when signed out': async ({ pass }) => {
    const both = mount({ 'logged-in': '', has: 'a:b:c' });
    await settled(both);
    expect(shown(both), 'signed in and holding the permission');
    both.remove();

    holdsPermission = false;
    await post('/kempo/api/test/reset', {});
    const lacking = mount({ 'logged-in': '', has: 'a:b:c' });
    await settled(lacking);
    expect(!shown(lacking), 'signed in without the permission');
    lacking.remove();

    signedIn = false;
    holdsPermission = true;
    await post('/kempo/api/test/reset', {});
    calls = [];
    const signedOut = mount({ 'logged-in': '', has: 'a:b:c' });
    await settled(signedOut);
    expect(!shown(signedOut), 'not signed in, even though the permission would be held');
    expect(!calls.includes('/kempo/api/user/current/permissions'), 'no permission request for someone who is not signed in');
    pass();
  },

  'a permission alone does not ask whether the visitor is signed in': async ({ pass }) => {
    const el = mount({ has: 'a:b:c' });
    await settled(el);
    expect(shown(el), 'the permission decides');
    expect(!calls.includes('/kempo/api/auth/session'), 'no session request');
    pass();
  },

  'with no settings it shows its content, as before': async ({ pass }) => {
    const el = mount();
    await settled(el);
    expect(shown(el), 'shown');
    expect(calls.length === 0, 'and asks nothing');
    pass();
  },

  'several on one page share a single session request': async ({ pass }) => {
    const elements = [mount({ 'logged-in': '' }), mount({ 'logged-in': '' }), mount({ 'logged-in': '' })];
    for(const el of elements) await settled(el);
    expect(elements.every(shown), 'all three are shown');
    expect(calls.filter(call => call === '/kempo/api/auth/session').length === 1, `expected one session request, got ${calls.length}`);
    pass();
  },
};
