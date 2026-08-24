import { registerComponentOverride } from '../src/admin/component-overrides.js';
import '../src/admin/components/PageEditor.js';

/*
  Runs the real admin-page-editor custom element in a real browser (see scripts/run-browser-tests.js
  for why: kempo-testing-framework's browser server is a flat static server, so /kempo-ui/**,
  /kempo/** and /kempo-css/** are junctioned onto node_modules/dist for the duration of this run).

  Network is the one thing faked: window.fetch is overridden below to answer the specific
  /kempo/api/pages/* calls PageEditor makes with canned responses, recording what it sent. Nothing
  inside PageEditor, component-overrides.js or the SDK is mocked or monkey-patched — they run for
  real, including lit-html's staticHtml/unsafeStatic template compilation and real custom element
  upgrade. HtmlEditor.getValue() falls back to its raw `.value` property until Lexical finishes
  loading (kempo-ui/src/components/HtmlEditor.js:599-608), so these tests don't need to wait for
  that async load to complete.
*/

window.kempo = {
  pathsToIcons: ['/kempo-ui/icons'],
  pathToStylesheet: '/kempo-css/kempo.min.css',
  lexicalUrl: '/kempo/vendor/lexical',
  monacoUrl: '/monaco-editor',
};

const realFetch = window.fetch.bind(window);
let responders = {};
let calls = [];

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const parsed = new URL(url, window.location.origin);
  const method = (init.method || 'GET').toUpperCase();
  const responder = responders[`${method} ${parsed.pathname}`];
  if(!responder) return realFetch(input, init);

  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ method, path: parsed.pathname, query: Object.fromEntries(parsed.searchParams), body });
  return new Response(JSON.stringify(responder(parsed, body)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const PAGE = {
  name: 'Test Page',
  title: 'Test Page',
  description: '',
  owner: 'custom',
  locked: false,
  template: 'default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  contents: [{ location: 'default', content: '<p>Original content</p>' }],
};

const TEMPLATES = { templates: [{ name: 'default', directory: '.', locations: ['default'] }] };

const mountEditor = async () => {
  history.replaceState(null, '', `${location.pathname}?path=test-page`);
  const el = document.createElement('admin-page-editor');
  document.body.appendChild(el);
  const start = Date.now();
  while(el.loading !== false){
    if(Date.now() - start > 5000) throw new Error('admin-page-editor never finished loading');
    await new Promise(r => setTimeout(r, 10));
  }
  if(el.error) throw new Error('admin-page-editor reported a load error');
  return el;
};

export const beforeEach = () => {
  responders = {
    'GET /kempo/api/pages/file': () => PAGE,
    'GET /kempo/api/templates': () => TEMPLATES,
    'PUT /kempo/api/pages/file': () => ({ updatedAt: new Date().toISOString() }),
  };
  calls = [];
  delete window.kempo.componentOverrides;
};

export const afterEach = () => {
  document.querySelectorAll('admin-page-editor').forEach(el => el.remove());
};

export default {
  'with no override registered, the content editor is the real k-html-editor': async ({ pass, fail }) => {
    const el = await mountEditor();
    const editor = el.shadowRoot.querySelector('[data-location="default"]');
    if(!editor) return fail('no [data-location="default"] element was rendered');
    if(editor.tagName.toLowerCase() !== 'k-html-editor'){
      return fail(`expected k-html-editor, got ${editor.tagName.toLowerCase()}`);
    }
    if(typeof editor.getValue !== 'function') return fail('rendered element has no getValue() method');
    pass();
  },

  'saving with no override sends the real k-html-editor\'s value to updatePage': async ({ pass, fail }) => {
    const el = await mountEditor();
    await el.handleSave();

    const saveCall = calls.find(c => c.method === 'PUT' && c.path === '/kempo/api/pages/file');
    if(!saveCall) return fail('handleSave() did not PUT /kempo/api/pages/file');

    const savedDefault = saveCall.body.contents.find(c => c.location === 'default');
    if(!savedDefault) return fail(`no 'default' location in the saved contents: ${JSON.stringify(saveCall.body.contents)}`);
    if(savedDefault.content !== '<p>Original content</p>'){
      return fail(`expected the untouched original content, got '${savedDefault.content}'`);
    }
    pass();
  },

  'registering an override for page-content-editor swaps the rendered tag': async ({ pass, fail }) => {
    customElements.get('k-fake-wysiwyg') || customElements.define('k-fake-wysiwyg', class extends HTMLElement {
      set value(v) { this._v = v; }
      get value() { return this._v; }
      getValue() { return 'FAKE EDITOR VALUE'; }
    });
    registerComponentOverride('page-content-editor', 'k-fake-wysiwyg');

    const el = await mountEditor();
    const editor = el.shadowRoot.querySelector('[data-location="default"]');
    if(!editor) return fail('no [data-location="default"] element was rendered');
    if(editor.tagName.toLowerCase() !== 'k-fake-wysiwyg'){
      return fail(`expected the registered override tag k-fake-wysiwyg, got ${editor.tagName.toLowerCase()}`);
    }
    if(editor.value !== '<p>Original content</p>'){
      return fail(`the .value property binding did not carry the page content to the override element, got '${editor.value}'`);
    }
    pass();
  },

  'saving with an override registered sends its getValue() to updatePage': async ({ pass, fail }) => {
    customElements.get('k-fake-wysiwyg') || customElements.define('k-fake-wysiwyg', class extends HTMLElement {
      set value(v) { this._v = v; }
      get value() { return this._v; }
      getValue() { return 'FAKE EDITOR VALUE'; }
    });
    registerComponentOverride('page-content-editor', 'k-fake-wysiwyg');

    const el = await mountEditor();
    await el.handleSave();

    const saveCall = calls.find(c => c.method === 'PUT' && c.path === '/kempo/api/pages/file');
    if(!saveCall) return fail('handleSave() did not PUT /kempo/api/pages/file');

    const savedDefault = saveCall.body.contents.find(c => c.location === 'default');
    if(savedDefault?.content !== 'FAKE EDITOR VALUE'){
      return fail(`expected the override element's getValue(), got '${savedDefault?.content}' — getFormState() is not reading the rendered override element`);
    }
    pass();
  },
};
