const escapeHtml = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const unescapeHtml = value => String(value)
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const UNSAFE_HREF = /^\s*(javascript|data|vbscript):/i;
const ICON_NAME = /^[\w-]+$/;

/*
  A menu item is stored as nothing more than one link, so the entry stays plain global content that
  any template renders without knowing about menus. This reads that link back into its fields, and
  returns null for markup that is anything more than a link with an optional icon.
*/
export const parseLink = markup => {
  const match = /^<a\s((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*)<\/a>$/.exec(String(markup || '').trim());
  if(!match || /<a[\s>]/.test(match[2])) return null;

  const attrs = {};
  const attrRegex = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)')/g;
  let a;
  while((a = attrRegex.exec(match[1])) !== null) attrs[a[1]] = a[2] ?? a[3];
  if(attrs.href === undefined) return null;

  const icon = /^\s*<k-icon\s+name="([\w-]+)"\s*><\/k-icon>/.exec(match[2]);
  const rest = icon ? match[2].slice(icon[0].length) : match[2];
  if(/</.test(rest)) return null;

  return {
    label: unescapeHtml(rest.trim()),
    href: unescapeHtml(attrs.href),
    icon: icon ? icon[1] : '',
    newTab: attrs.target === '_blank'
  };
};

/*
  Returns [error, markup], with the same error shape as the rest of the server utils.
*/
export const buildLink = ({ label, href, icon, newTab }) => {
  if(!String(label || '').trim()) return [{ code: 400, msg: 'Label is required' }, null];
  if(!String(href || '').trim()) return [{ code: 400, msg: 'Link is required' }, null];
  if(UNSAFE_HREF.test(href)) return [{ code: 400, msg: 'That link is not allowed' }, null];
  if(icon && !ICON_NAME.test(icon)) return [{ code: 400, msg: 'Icon names use letters, numbers, dashes and underscores' }, null];

  const target = newTab ? ' target="_blank" rel="noopener"' : '';
  const iconMarkup = icon ? `<k-icon name="${icon}"></k-icon> ` : '';
  return [null, `<a href="${escapeHtml(href.trim())}"${target}>${iconMarkup}${escapeHtml(label.trim())}</a>`];
};
