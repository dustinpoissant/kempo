export const camelToDash = (str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
export const dashToCamel = (str) => str.replace(/-([a-z])/g, (_, group) => group.toUpperCase());
export const isCamelCase = (str) => /[a-z][A-Z]/.test(str);
export const getCase = (str) => {
  if(isCamelCase(str)){
    return {
      camel: str,
      dash: camelToDash(str)
    }
  } else {
    return {
      camel: dashToCamel(str),
      dash: str
    }
  }
}
export const escapeHTML = str => str.replace(/[&<>"'/]/g, match => {
  switch (match) {
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '"':
      return '&quot;';
    case "'":
      return '&#39;';
    case '/':
      return '&#x2F;';
    default:
      return match;
  }
});
export const unescapeHTML = str => str.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x2F;/g, match => {
  switch (match) {
    case '&amp;':
      return '&';
    case '&lt;':
      return '<';
    case '&gt;':
      return '>';
    case '&quot;':
      return '"';
    case '&#39;':
      return "'";
    case '&#x2F;':
      return '/';
    default:
      return match;
  }
});
export const trim = (str, chars) => str.replace(new RegExp(`^[${chars}]+|[${chars}]+$`, 'g'), '');
export const compoundKey = keys => trim(keys.join('.'), '.');