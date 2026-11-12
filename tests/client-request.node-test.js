import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';

/*
  The browser's request layer: a read that several components ask for at once is sent once, a read that was just
  answered is kept for a few seconds, and a write clears what was kept. The SDKs of kempo's extensions use it too.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { request, get, post } = await import(pathToFileURL(path.join(root, 'src/kempo/fetch.js')).href);

const realFetch = globalThis.fetch;
let calls = [];
let answer = () => ({ status: 200, body: { ok: true } });

const stub = () => {
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    const { status, body } = answer(url, options);
    const response = new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    await new Promise(resolve => setTimeout(resolve, 5));
    return response;
  };
};

const reset = () => {
  calls = [];
  answer = () => ({ status: 200, body: { ok: true } });
};

/*
  The stub is in place for one test at a time. Suites run in one process, so a fetch left replaced would answer every
  later suite's requests (a sign-in, a page) with this file's canned reply.
*/
export const beforeEach = stub;

export const afterEach = () => {
  globalThis.fetch = realFetch;
};

export default {
  'identical reads at the same time are one request': async ({ pass, fail }) => {
    reset();
    const url = '/test/shared-' + Date.now();
    const results = await Promise.all([request('GET', url), request('GET', url), get(url)]);
    const sent = calls.filter(call => call.url === url).length;
    if(sent !== 1) return fail(`sent ${sent} requests for three identical reads`);
    if(!results.every(([error, data]) => !error && data.ok)) return fail('every caller should get the answer');
    pass('');
  },

  'a read answered a moment ago is not sent again': async ({ pass, fail }) => {
    reset();
    const url = '/test/recent-' + Date.now();
    await request('GET', url);
    await request('GET', url);
    const sent = calls.filter(call => call.url === url).length;
    if(sent !== 1) return fail(`sent ${sent} requests for two reads in a row`);
    pass('');
  },

  'each caller gets its own copy of a cached answer': async ({ pass, fail }) => {
    reset();
    const url = '/test/copy-' + Date.now();
    const [, first] = await request('GET', url);
    first.ok = 'changed by a caller';
    const [, second] = await request('GET', url);
    if(second.ok !== true) return fail('one caller changed what another was given');
    pass('');
  },

  'a write clears what was kept, so the next read is fresh': async ({ pass, fail }) => {
    reset();
    const url = '/test/after-write-' + Date.now();
    await request('GET', url);
    await request('PATCH', '/test/some-item', { name: 'changed' });
    await request('GET', url);
    const sent = calls.filter(call => call.url === url).length;
    if(sent !== 2) return fail(`sent ${sent} reads around a write; expected 2`);
    pass('');
  },

  'a failed read is not kept': async ({ pass, fail }) => {
    reset();
    const url = '/test/failing-' + Date.now();
    answer = () => ({ status: 404, body: { error: 'Not found' } });
    const [error] = await request('GET', url);
    if(error?.code !== 404 || error.msg !== 'Not found') return fail(`expected a 404 tuple, got ${JSON.stringify(error)}`);
    answer = () => ({ status: 200, body: { ok: true } });
    const [, data] = await request('GET', url);
    if(!data?.ok) return fail('the failure was kept and returned again');
    pass('');
  },

  'the kempo SDK helpers still share requests with request()': async ({ pass, fail }) => {
    reset();
    const url = '/test/mixed-' + Date.now();
    await Promise.all([request('GET', url), get(url)]);
    const sent = calls.filter(call => call.url === url).length;
    if(sent !== 1) return fail(`sent ${sent} requests`);
    await post('/test/mixed-post', { a: 1 });
    pass('');
  },
};
