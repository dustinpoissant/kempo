/*
  Small HTML helpers shared by the server and the editor. Nothing here touches the DOM or Node, so the same code
  renders a page in the browser (the editor) and on the server (the file that gets written).
*/

export const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

export const TEXT_BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre']);

export const INLINE_TAGS = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'ins', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr']);

export const escapeText = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export const escapeAttribute = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/* A web address a page may link to or load: same-site paths, anchors, and http, https, mailto and tel. */
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\.\.?\/)/i;

export const safeUrl = value => {
  const text = String(value ?? '').trim();
  if(!text) return '';
  return SAFE_URL.test(text) ? text : '';
};
