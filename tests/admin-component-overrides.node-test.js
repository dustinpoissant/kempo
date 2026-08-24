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

const { registerComponentOverride, getComponentOverride } = await import(
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
};
