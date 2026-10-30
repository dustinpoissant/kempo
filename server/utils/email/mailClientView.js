import { transformRules } from './cssRules.js';

/*
  What a mail client like Gmail keeps of an email's CSS, so a preview can show the email the way it will arrive instead of the way a
  browser draws it. Gmail keeps only `position: relative` (Campaign Monitor), so other positions go. It approximates Gmail on the web: page-level rules (`:root`, `html`, `body`, `*`), interactive and pseudo-element
  selectors, newer colour and value functions, and animation or transition properties are removed, and `<link>` stylesheets too.
  Rules that survive are kept as they are. Refine the lists against real Gmail renders, not against a browser.
*/
const DROPPED_PROPERTIES = new Set(['color-scheme', 'interpolate-size', 'scrollbar-gutter', 'transition', 'transition-property', 'transition-duration', 'transition-timing-function', 'animation', 'will-change', 'backdrop-filter', 'user-select', 'box-shadow']);
const DROPPED_VALUE = /oklch\(|oklab\(|color-mix\(|light-dark\(|var\(|env\(/i;
const DROPPED_SELECTOR = /(^|[\s,>+~(])(:root|html|body|\*)(?![\w-])|::?(hover|focus|focus-visible|active|before|after|placeholder|selection)\b|:not\(/i;

export const filterDeclarations = body => body
  .split(';')
  .map(declaration => declaration.trim())
  .filter(Boolean)
  .filter(declaration => {
    const [property, ...rest] = declaration.split(':');
    const name = property.trim().toLowerCase();
    const value = rest.join(':');
    if(DROPPED_PROPERTIES.has(name)) return false;
    if(name === 'position' && !/^\s*relative\s*$/i.test(value)) return false;
    return !DROPPED_VALUE.test(value);
  })
  .join(';');

export const filterSelectors = prelude => prelude
  .split(',')
  .map(selector => selector.trim())
  .filter(selector => selector && !DROPPED_SELECTOR.test(selector))
  .join(', ');

export const filterCss = css => transformRules(css, { selector: filterSelectors, declarations: filterDeclarations });

export default html => String(html ?? '')
  .replace(/<link\b[^>]*>/gi, '')
  .replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (match, attributes, css) => `<style${attributes}>${filterCss(css)}</style>`)
  .replace(/(\sstyle\s*=\s*)"([^"]*)"/gi, (match, prefix, declarations) => `${prefix}"${filterDeclarations(declarations)}"`);
