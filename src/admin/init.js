window.kempo = { pathsToIcons: ['/admin/icons', '/kempo/icons', '/kempo-ui/icons'], monacoUrl: '/monaco-editor' };
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
