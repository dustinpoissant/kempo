window.kempo = { pathsToIcons: ['/admin/icons', '/kempo/icons', '/kempo-ui/icons'], monacoUrl: '/monaco-editor', lexicalUrl: '/kempo/vendor/lexical' };
window.litDisableBundleWarning = true;

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
