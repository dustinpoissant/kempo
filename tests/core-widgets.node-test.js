import path from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  The widgets for kempo's own functions (sign in and out, the password forms, who someone is, what they may see,
  notifications): each is declared with the element and the files that back it, the builder's copies never sign anyone in
  or out, and the pages that come with kempo are made of the same elements.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => (await import(pathToFileURL(path.join(root, relative)).href));
const read = relative => readFile(path.join(root, relative), 'utf8');

const coreWidgets = (await load('src/kempo/pagebuilder/coreWidgets.js')).default;
await load('server/utils/sitebuilder/registry.js');
const { widgets, registryOf } = await import('kempo-ui/src/utils/pageWidgets.js');
const { renderPage, collectModules } = await import('kempo-ui/src/utils/renderPage.js');
const { createNode } = await import('kempo-ui/src/utils/pageTree.js');
const registry = registryOf(widgets);

const camel = name => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const fileOf = url => `src/kempo/components/${url.split('/').pop()}`;

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

export default {
  'every core widget is registered, with its element, its component file and its builder copy': async ({ pass, fail }) => {
    try {
      const editors = await read('src/admin/components/pagebuilder/CoreWidgetEditors.js');
      for(const widget of coreWidgets){
        expect(widgets.some(registered => registered.name === widget.name), `${widget.name} is not registered`);
        const source = await read(fileOf(widget.page));
        if(widget.tag === 'button') expect(source.includes('button[data-') && source.includes("addEventListener('click'"), `${widget.page} does not make its button work`);
        else expect(new RegExp(`customElements\\.define\\('${widget.tag}'`).test(source), `${widget.tag} is not defined by ${widget.page}`);
        if(widget.editor){
          expect(widget.editor === '/admin/components/pagebuilder/CoreWidgetEditors.js', `${widget.name} has an editor in the wrong place`);
          expect(editors.includes(`customElements.define('${widget.editorTag}'`), `${widget.editorTag} is not defined`);
        }
      }
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'every setting a core widget has is one its element reads': async ({ pass, fail }) => {
    try {
      for(const widget of coreWidgets){
        const source = await read(fileOf(widget.page));
        for(const attribute of widget.tag === 'button' ? [] : widget.attributes ?? []){
          const property = camel(attribute.name);
          expect(source.includes(`${property}:`) || source.includes(`get ${property}`) || source.includes(`attribute: '${attribute.name}'`), `${widget.name}: ${attribute.name} is not read by ${widget.page}`);
        }
      }
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'the builder copies never sign anyone in or out, or send a form, and always show what a permission would hide': async ({ pass, fail }) => {
    try {
      const source = (await read('src/admin/components/pagebuilder/CoreWidgetEditors.js')).replace(/\/\*[\s\S]*?\*\//, '');
      expect(!/sdk\.js|fetch\(|login\(|logout\(|register\(/.test(source), 'an editor reaches the server');
      for(const handler of ['submit = event => event.preventDefault()', 'askForCode = nothing', 'deleteAccount = nothing']){
        expect(source.includes(handler), `missing: ${handler}`);
      }
      expect(source.includes('this.hasPermission = true'), 'permission content is not always shown');
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'core widgets are written as their own elements, with what is inside them left inside, and the builder uses its copy': async ({ pass, fail }) => {
    try {
      const login = renderPage([createNode('login', { redirect: '/home' }, { default: [createNode('text', { html: '<p>Or use a code</p>' })] })], registry);
      expect(login.startsWith('<k-login') && login.includes('redirect="/home"') && login.includes('Or use a code') && !login.includes('slot='), login);
      expect(!renderPage([createNode('login', {})], registry).includes('redirect='), 'a default setting was written');
      const permission = renderPage([createNode('permission', { has: 'system:admin:access' }, { default: [createNode('text', { html: '<p>Hi</p>' })] })], registry);
      expect(permission.startsWith('<k-permission') && permission.includes('has="system:admin:access"'), permission);
      const signedIn = renderPage([createNode('permission', { 'logged-in': true })], registry);
      expect(signedIn.startsWith('<k-permission') && /<k-permission[^>]* logged-in(="")?[ >]/.test(signedIn), `logged-in was not written: ${signedIn}`);
      expect(!renderPage([createNode('permission', {})], registry).includes('logged-in'), 'a default setting was written');
      const logout = renderPage([createNode('logout', { label: 'Sign out', redirect: '/login', color: 'danger' })], registry);
      expect(/^<button class="btn danger[^"]*"[^>]* data-redirect="\/login"[^>]* type="button" data-logout>Sign out<\/button>$/.test(logout.trim()) || (logout.includes('<button') && logout.includes('data-logout') && logout.includes('data-redirect="/login"') && logout.includes('btn danger') && logout.includes('>Sign out<')), logout);
      expect(!logout.includes('<k-logout-btn') && !logout.includes('style='), `the button has an element or a style around it: ${logout}`);
      const change = renderPage([createNode('change-password', { label: 'Change it' })], registry);
      expect(change.includes('<button') && change.includes('data-change-password') && change.includes('>Change it<') && !change.includes('<k-change-password'), change);
      const editing = renderPage([createNode('logout', {})], registry, { editor: true });
      expect(editing.startsWith('<a ') && !editing.includes('data-logout'), `the builder's copy can sign someone out: ${editing}`);
      const builder = renderPage([createNode('login', {})], registry, { editor: true });
      expect(builder.startsWith('<k-login-editor'), builder);
      const modules = collectModules([createNode('login', {}), createNode('user-name', {})], registry, { editor: true });
      expect(modules.includes('/kempo/components/Login.js') && modules.includes('/admin/components/pagebuilder/CoreWidgetEditors.js') && modules.includes('/kempo/components/UserName.js'), modules.join());
      pass('');
    } catch(error) {
      fail(error.message);
    }
  },

  'the pages that come with kempo are made of these elements, with no form code of their own': async ({ pass, fail }) => {
    try {
      const pages = {
        'login': ['k-login', 'Login.js'],
        'register': ['k-register', 'Register.js'],
        'forgot-password': ['k-forgot-password', 'ForgotPassword.js'],
        'reset-password/[token]': ['k-reset-password', 'ResetPassword.js'],
        'delete-account': ['k-delete-account', 'DeleteAccount.js'],
        'account': ['button class="btn d-ib mb mrq" type="button" data-change-password', 'ChangePasswordButton.js'],
      };
      for(const [page, [tag, file]] of Object.entries(pages)){
        const source = await read(`app-public/${page}/index.page.html`);
        expect(source.includes(`<${tag}`) && source.includes(`kempo/components/${file}`), `${page} does not use ${tag}`);
        expect(!/<form|getElementById/.test(source), `${page} still has form code of its own`);
      }
      pass('');
    } catch(error) {
      fail(error.message);
    }
  }
};
