/*
  Lets an extension swap in its own custom element for a named admin panel slot — e.g. replacing
  the page/fragment content editor (`k-html-editor`) with a custom WYSIWYG.

  Backed by window.kempo rather than module-local state so registration works regardless of how
  many times this module is imported (once per admin page load, from wherever an extension's script
  runs — see docs/extensions/creating-extensions.md).

  A replacement for the 'page-content-editor' slot must, at minimum: accept a `.value` property
  with the initial HTML, expose a `getValue()` method returning the current HTML, and support a
  boolean `disabled` attribute. It may ignore `controls`/`mode`, which are k-html-editor-specific.
*/

export const registerComponentOverride = (slot, tagName) => {
  window.kempo = window.kempo || {};
  window.kempo.componentOverrides = window.kempo.componentOverrides || {};
  window.kempo.componentOverrides[slot] = tagName;
};

export const getComponentOverride = (slot, fallbackTagName) =>
  window.kempo?.componentOverrides?.[slot] || fallbackTagName;
