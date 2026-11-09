import '../src/admin/components/pagebuilder/PageBuilderEditor.js';
import ButtonControl from '/kempo-ui/components/controls/ButtonControl.js';
import Control from '/kempo-ui/components/controls/Control.js';

/*
  Runs the real admin-page-builder custom element (kempo's page editor around kempo-ui's k-page-builder) in a real
  browser (see scripts/run-browser-tests.js for how /kempo/**, /kempo-ui/** and /kempo-css/** are made available).

  Network is the one thing faked: window.fetch answers the two sitebuilder routes the element reads (the extensions'
  widgets and the saved templates). The page editor around it is a small stand-in that records what the element asks of it.
*/

window.kempo = {
  pathsToIcons: ['/kempo-ui/icons'],
  pathToStylesheet: '/kempo-css/kempo.min.css',
  lexicalUrl: '/kempo/vendor/lexical',
  monacoUrl: '/monaco-editor',
};

const realFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const parsed = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
  const body = { '/kempo/api/sitebuilder/widgets': { widgets: [] }, '/kempo/api/sitebuilder/templates': { templates: [] } }[parsed.pathname];
  if(!body) return realFetch(input, init);
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const text = (id, html) => ({ id, type: 'text', attrs: { html }, slots: {} });

const DATA = {
  file: 'test.page.html',
  hash: 'one',
  state: 'builder',
  page: { owner: 'custom', variables: ['year', 'title'] },
  locations: [{ name: 'default', label: null, code: false }, { name: 'scripts', label: null, code: false }, { name: 'head', label: null, code: true }],
  trees: { default: [text('t1', '<p>Main</p>')], scripts: [text('t2', '<p>Scripts</p>')] }
};

const mount = async (owner = 'custom') => {
  const el = document.createElement('admin-page-builder');
  const host = {
    saves: 0,
    called: [],
    metas: [],
    page: { owner, author: 'Someone', createdAt: '2026-04-11T02:13:14.000Z', updatedAt: '2026-11-04T09:37:52.000Z', extraMetadata: { status: 'live' } },
    save() { this.saves++; },
    setMeta: changes => host.metas.push(changes),
    getPageUrl: () => '/test',
    templateChoices: () => [{ name: 'default', label: '/default' }, { name: 'wide', label: '/wide' }],
    handleCopy: () => host.called.push('copy'),
    handleMove: () => host.called.push('move'),
    handleReplace: () => host.called.push('replace'),
    handleDelete: () => host.called.push('delete'),
    openCode: location => host.called.push(`code ${location}`)
  };
  el.data = structuredClone(DATA);
  el.host = host;
  el.meta = { name: 'Test', title: 'Test', description: '', template: 'default' };
  document.body.appendChild(el);
  const start = Date.now();
  while(!el.shadowRoot?.querySelector('k-page-builder')?.value?.slots?.default?.length){
    if(Date.now() - start > 8000) throw new Error('admin-page-builder never showed its page');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const control = el.shadowRoot.querySelector('admin-pb-location');
  await control?.updateComplete;
  return { el, host, builder: el.shadowRoot.querySelector('k-page-builder'), control, select: control?.shadowRoot.querySelector('select') };
};

const settle = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

export const beforeEach = () => {
  history.replaceState(null, '', location.pathname + location.search);
};

export const afterEach = () => {
  document.querySelectorAll('admin-page-builder').forEach(el => el.remove());
  history.replaceState(null, '', location.pathname + location.search);
};

const labelsOf = (builder, slot) => [...builder.querySelectorAll(`:scope > [slot="${slot}"]`)].map(control => control.label);

export default {
  'the controls kempo adds are kempo-ui controls': async ({ pass, fail }) => {
    const { builder, control } = await mount();
    const added = [...builder.children].filter(child => child.slot && child.slot !== 'page-settings');
    if(added.length !== 8) return fail(`${added.length} controls were added`);
    const strangers = added.filter(child => !(child instanceof Control)).map(child => child.localName);
    if(strangers.length) return fail(`not kempo-ui controls: ${strangers.join(', ')}`);
    const plain = added.filter(child => child.localName === 'admin-pb-control' && !(child instanceof ButtonControl)).length;
    if(plain || !(control instanceof Control)) return fail('the buttons should be ButtonControls and the area chooser a Control');
    pass();
  },

  'the page\'s actions have the lowest priority so they move into the bar\'s more menu first, and the links and area chooser keep theirs': async ({ pass, fail }) => {
    const { builder } = await mount();
    const groupOf = slot => builder.renderRoot.querySelector(`slot[name="${slot}"]`).parentElement;
    if(groupOf('right-start').getAttribute('priority') !== '-1') return fail(`the page's actions have priority ${groupOf('right-start').getAttribute('priority')}`);
    if(groupOf('left-end').getAttribute('priority') !== '8') return fail(`the links and area chooser have priority ${groupOf('left-end').getAttribute('priority')}`);
    if(builder.querySelectorAll('k-dropdown').length) return fail('kempo added a menu of its own');
    pass();
  },

  'a custom page gets all the page\'s actions, a system page only the ones it may use': async ({ pass, fail }) => {
    const custom = await mount();
    const customLabels = labelsOf(custom.builder, 'right-start').join();
    document.querySelectorAll('admin-page-builder').forEach(el => el.remove());
    const system = await mount('system');
    const systemLabels = labelsOf(system.builder, 'right-start').join();
    if(customLabels !== 'Head code,Copy page,Move page,Replace another page,Delete page') return fail(customLabels);
    if(systemLabels !== 'Head code,Copy page') return fail(systemLabels);
    pass();
  },

  'the page\'s name and template are in the page settings panel, not in a dialog': async ({ pass, fail }) => {
    const { el, host, builder } = await mount();
    const panel = builder.querySelector(':scope > [slot="page-settings"]');
    const name = el.shadowRoot.querySelector('#pb-page-name');
    const template = el.shadowRoot.querySelector('#pb-page-template');
    if(!panel || !name || !template) return fail('the page settings panel has no name and template');
    if(name.value !== 'Test' || [...template.options].map(option => option.value).join() !== 'default,wide' || template.value !== 'default') return fail(`name ${name.value}, templates ${[...template.options].map(option => option.value)}, chosen ${template.value}`);
    name.value = 'Renamed';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    template.value = 'wide';
    template.dispatchEvent(new Event('change', { bubbles: true }));
    if(JSON.stringify(host.metas) !== JSON.stringify([{ name: 'Renamed' }, { template: 'wide' }])) return fail(JSON.stringify(host.metas));
    if(document.querySelector('k-dialog')) return fail('a dialog was opened');
    if(!panel.textContent.includes('Someone') || !panel.textContent.includes('live')) return fail('who made the page and its extra metadata are not shown');
    pass();
  },

  'a system page\'s name cannot be changed in the page settings panel': async ({ pass, fail }) => {
    const { el } = await mount('system');
    if(!el.shadowRoot.querySelector('#pb-page-name').disabled) return fail('the name of a system page can be changed');
    pass();
  },

  'pressing a page action calls the page editor': async ({ pass, fail }) => {
    const { host, builder } = await mount();
    const press = label => [...builder.querySelectorAll('admin-pb-control')].find(control => control.label === label).click();
    ['Head code', 'Copy page', 'Move page', 'Replace another page', 'Delete page'].forEach(press);
    if(host.called.join() !== 'code head,copy,move,replace,delete') return fail(host.called.join());
    pass();
  },

  'the link controls go back to the pages and open the page in a new tab': async ({ pass, fail }) => {
    const { builder } = await mount();
    const [back, view] = builder.querySelectorAll('admin-pb-control[href]');
    const opened = [];
    const open = window.open;
    window.open = (...args) => opened.push(args);
    view.click();
    window.open = open;
    if(back.href !== '/admin/content/pages' || back.label !== 'Back to the pages') return fail(`back: ${back.href} ${back.label}`);
    if(opened.length !== 1 || opened[0][0] !== '/test' || opened[0][1] !== '_blank') return fail(JSON.stringify(opened));
    pass();
  },

  'it offers the page\'s content areas, and not its code area': async ({ pass, fail }) => {
    const { select } = await mount();
    const names = [...select.options].map(option => option.value).join();
    if(names !== 'default,scripts') return fail(`the areas offered were ${names}`);
    pass();
  },

  'the first content area is edited when the address has no hash': async ({ pass, fail }) => {
    const { el, builder } = await mount();
    if(el.location !== 'default' || builder.value.slots.default[0].id !== 't1') return fail(`it opened ${el.location}`);
    pass();
  },

  'a content area in the address hash is the one edited, and the select shows it': async ({ pass, fail }) => {
    history.replaceState(null, '', `${location.pathname}${location.search}#scripts`);
    const { el, builder, select } = await mount();
    if(el.location !== 'scripts' || builder.value.slots.default[0].id !== 't2') return fail(`it opened ${el.location}`);
    if(select.value !== 'scripts') return fail(`the select shows ${select.value}`);
    pass();
  },

  'a hash that is not a content area of the page is ignored': async ({ pass, fail }) => {
    history.replaceState(null, '', `${location.pathname}${location.search}#nonsense`);
    const { el } = await mount();
    if(el.location !== 'default') return fail(`it opened ${el.location}`);
    pass();
  },

  'choosing a content area puts it in the hash, the first one has none, and back and forward follow': async ({ pass, fail }) => {
    const { el, builder, select } = await mount();
    select.value = 'scripts';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    if(location.hash !== '#scripts' || el.location !== 'scripts' || builder.value.slots.default[0].id !== 't2') return fail(`after choosing scripts: ${location.hash} ${el.location}`);
    select.value = 'default';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    if(location.hash !== '' || el.location !== 'default') return fail(`after choosing the first: "${location.hash}" ${el.location}`);
    history.back();
    await settle();
    if(el.location !== 'scripts' || select.value !== 'scripts') return fail(`after back: ${el.location}, select ${select.value}`);
    history.forward();
    await settle();
    if(el.location !== 'default' || select.value !== 'default') return fail(`after forward: ${el.location}, select ${select.value}`);
    pass();
  },

  'a change in one content area is kept while another is edited, and both are sent to be saved': async ({ pass, fail }) => {
    const { el, builder, select } = await mount();
    builder.setWidgetAttribute('t1', 'html', '<p>Changed</p>', true);
    select.value = 'scripts';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const trees = el.getTrees();
    if(trees.default[0].attrs.html !== '<p>Changed</p>' || trees.scripts[0].id !== 't2') return fail(JSON.stringify(trees));
    pass();
  },

  'a save request goes to the page editor, and the page stays unsaved until the editor says it is stored': async ({ pass, fail }) => {
    const { el, host, builder } = await mount();
    builder.setWidgetAttribute('t1', 'html', '<p>Changed</p>', true);
    builder.requestSave();
    if(host.saves !== 1) return fail(`the page editor was asked to save ${host.saves} times`);
    if(!builder.dirty || !el.dirty) return fail('the page counted as saved before it was stored');
    el.getTrees();
    el.markSaved();
    if(builder.dirty || el.dirty) return fail('the page was not counted as saved once it was stored');
    pass();
  },

  'Ctrl+S asks the page editor to save once': async ({ pass, fail }) => {
    const { host } = await mount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
    await settle();
    if(host.saves !== 1) return fail(`the page editor was asked to save ${host.saves} times`);
    pass();
  }
};
