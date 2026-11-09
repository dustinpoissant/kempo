window.kempo = { pathsToIcons: ['/admin/icons', '/kempo/icons', '/kempo-ui/icons'], pathToStylesheet: '/kempo-css/kempo.min.css', monacoUrl: '/monaco-editor', lexicalUrl: '/kempo/vendor/lexical' };
window.litDisableBundleWarning = true;
try{
  document.documentElement.setAttribute('theme', localStorage.getItem('theme') || 'auto');
}catch(e){}

/*
  Dynamic imports are required here becasue static imports are hoisted and resolved before any code runs,
     meaning window.kempo would not yet be set when these components initialize.
  Dynamic import() is called at runtime, after the synchronous assignments above,
  guaranteeing window.kempo.pathsToIcons is available when the components load.
*/
import('/kempo-ui/components/Import.js');
import('/kempo-ui/components/Aside.js');
import('/kempo-ui/components/Main.js');

/*
  Toasts appear at the bottom right in the admin (the top right is covered by the page builder's controls and the
  tables' actions). A call that gives its own position still wins.
*/
import('/kempo-ui/components/Toast.js').then(({ default: Toast }) => {
  const create = Toast.create.bind(Toast);
  Toast.create = (message, options = {}) => create(message, { position: window.innerWidth <= 768 ? 'bottom center' : 'bottom right', ...options });
});

/*
  Ctrl+S (Cmd+S) presses the page's Save button, so every admin page saves from the keyboard and the browser's own "save page" never
  opens over an editor. A button can say it is the page's Save button with `data-save` (use it for "Create ..." buttons); without it,
  the one visible button whose label starts with "Save" is used. An editor that handles the key itself (the page, template and
  fragment editors, the page builder) has already prevented the default, and a page with no such button, or with several, is left alone.
*/
const buttonsIn = (root, found = []) => {
  root.querySelectorAll('button').forEach(button => found.push(button));
  root.querySelectorAll('*').forEach(element => element.shadowRoot && buttonsIn(element.shadowRoot, found));
  return found;
};
window.addEventListener('keydown', event => {
  if(!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 's' || event.defaultPrevented) return;
  if(document.querySelector('k-dialog[opened]')) return;
  const visible = buttonsIn(document).filter(button => button.getClientRects().length);
  const marked = visible.filter(button => button.hasAttribute('data-save'));
  const [only, ...others] = marked.length ? marked : visible.filter(button => /^\s*Sav(e|ing)\b/i.test(button.textContent));
  if(!only || others.length) return;
  event.preventDefault();
  if(!only.disabled) only.click();
});
