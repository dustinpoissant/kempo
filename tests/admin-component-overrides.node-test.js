import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  component-overrides.js is a browser module (writes to window.kempo), but its register/get
  contract is plain object logic with no DOM dependency — globalThis stands in for window here.
  The actual rendering path (PageEditor.js swapping the k-html-editor tag via lit-html's
  staticHtml/unsafeStatic) was verified manually in a real browser; see the commit this test
  shipped with.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

globalThis.window = globalThis.window || globalThis;

const { registerComponentOverride, getComponentOverride, registerEditorExtension, getEditorExtensions } = await import(
  pathToFileURL(path.join(root, 'src/admin/component-overrides.js')).href
);

export default {
  'getComponentOverride falls back when nothing is registered': async ({ pass, fail }) => {
    delete window.kempo;
    const tag = getComponentOverride('page-content-editor', 'k-html-editor');
    if(tag !== 'k-html-editor') return fail(`expected the fallback tag, got '${tag}'`);
    pass();
  },

  'registerComponentOverride is picked up by getComponentOverride': async ({ pass, fail }) => {
    delete window.kempo;
    registerComponentOverride('page-content-editor', 'my-ext-wysiwyg');
    const tag = getComponentOverride('page-content-editor', 'k-html-editor');
    if(tag !== 'my-ext-wysiwyg') return fail(`expected the registered tag, got '${tag}'`);
    pass();
  },

  'registration merges into an existing window.kempo rather than replacing it': async ({ pass, fail }) => {
    delete window.kempo;
    window.kempo = { lexicalUrl: '/kempo/vendor/lexical' };
    registerComponentOverride('page-content-editor', 'my-ext-wysiwyg');
    if(window.kempo.lexicalUrl !== '/kempo/vendor/lexical') return fail('registration clobbered an existing window.kempo property');
    if(window.kempo.componentOverrides['page-content-editor'] !== 'my-ext-wysiwyg') return fail('registration did not land');
    pass();
  },

  'an unrelated slot does not pick up another slot\'s override': async ({ pass, fail }) => {
    delete window.kempo;
    registerComponentOverride('page-content-editor', 'my-ext-wysiwyg');
    const tag = getComponentOverride('some-other-slot', 'default-tag');
    if(tag !== 'default-tag') return fail(`expected the fallback tag for an unregistered slot, got '${tag}'`);
    pass();
  },
  'with nothing registered the editor gets no extra nodes or controls': async ({ pass, fail }) => {
    delete window.kempo;
    const { nodes, controls } = getEditorExtensions();
    if(nodes.length || controls.length) return fail('expected empty lists');
    pass();
  },

  'several extensions add nodes and controls, each once, without touching other window.kempo state': async ({ pass, fail }) => {
    delete window.kempo;
    window.kempo = { lexicalUrl: '/vendor/lexical' };
    registerEditorExtension({ nodes: ['/a/Node.js'], controls: ['a-insert'] });
    registerEditorExtension({ nodes: ['/b/Node.js', '/a/Node.js'], controls: ['b-insert', 'a-insert'] });
    registerEditorExtension();
    const { nodes, controls } = getEditorExtensions();
    if(nodes.join() !== '/a/Node.js,/b/Node.js') return fail('nodes were ' + nodes);
    if(controls.join() !== 'a-insert,b-insert') return fail('controls were ' + controls);
    if(window.kempo.lexicalUrl !== '/vendor/lexical') return fail('registration clobbered an existing window.kempo property');
    pass();
  },
};
