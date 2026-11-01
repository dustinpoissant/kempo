import sanitizeHtmlLibrary from 'sanitize-html';

/*
  The server's half of the sanitizing. The editor cleans what a person types as they type it, but anyone can send
  this server a request without ever loading the editor, so everything the builder writes to a page is cleaned again
  here. Both halves use the same list of what is allowed. Template syntax ({{ }}) is plain text to the sanitizer and
  is kept.
*/

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i, /^[a-z]+$/i];

const MARKUP = {
  allowedTags: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'em', 'strong', 'b', 'i', 'u', 's', 'sub', 'sup', 'span', 'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td'],
  allowedAttributes: {
    '*': ['class', 'dir', 'lang', 'style'],
    a: ['href', 'title', 'target', 'rel', 'name'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    ol: ['start', 'type'],
    li: ['value'],
    td: ['colspan', 'rowspan', 'align'],
    th: ['colspan', 'rowspan', 'scope', 'align']
  },
  allowedStyles: {
    '*': {
      color: COLOR,
      'background-color': COLOR,
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/],
      'text-decoration': [/^(none|underline|line-through)( (underline|line-through))*$/],
      'white-space': [/^(pre|pre-wrap|normal)$/]
    }
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target === '_blank' ? { ...attribs, rel: 'noopener noreferrer' } : attribs
    })
  }
};

/* Rich text: paragraphs, headings, lists, quotes, code, inline formatting, links, pictures and tables. */
export const sanitizeMarkup = html => sanitizeHtmlLibrary(String(html ?? ''), MARKUP);

/* Plain text: every tag is removed and only the words are kept (used for table cells and labels). */
export const sanitizeText = text => sanitizeHtmlLibrary(String(text ?? ''), { allowedTags: [], allowedAttributes: {} })
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"');
