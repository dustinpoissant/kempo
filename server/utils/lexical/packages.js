/*
  The lexical packages kempo-ui's HtmlEditor imports, and how each one's browser bundle is named on
  disk. Shared by the build (which produces the bundles) and the middleware (which serves them), so
  the two cannot drift.

  This lives under server/utils rather than scripts/ because scripts/ is not published — a
  middleware importing from there would resolve here but be missing for every consumer.
*/
/*
  Where the bundles are served. The build stamps this into chunk references and the middleware
  answers on it, so the two must agree.
*/
export const LEXICAL_BASE = '/kempo/vendor/lexical';

export const LEXICAL_PACKAGES = [
  'lexical',
  '@lexical/rich-text',
  '@lexical/html',
  '@lexical/history',
  '@lexical/list',
  '@lexical/link',
  '@lexical/selection',
  '@lexical/table',
  '@lexical/code',
];

// "@lexical/rich-text" is not a usable filename, so the scope marker and slash are flattened
export const bundleFileName = pkg => `${pkg.replace('@', '').replace('/', '__')}.js`;
