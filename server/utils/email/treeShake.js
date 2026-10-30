import { transformRules } from './cssRules.js';

/*
  Keeps only the rules that can match something in the email, the way kempo-css's shake does for the page. A selector is kept when
  the element, classes and id it ends in are all on the page. Anything it cannot check (an attribute, a combinator's other side)
  is left out of the test, so a rule is only ever kept by mistake, never dropped while it would match.
*/
const tokensOf = html => {
  const tags = new Set();
  const classes = new Set();
  const ids = new Set();
  for(const [, tag] of html.matchAll(/<([a-z][a-z0-9-]*)/gi)) tags.add(tag.toLowerCase());
  for(const match of html.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) for(const name of (match[1] ?? match[2]).split(/\s+/)) if(name) classes.add(name);
  for(const match of html.matchAll(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) ids.add((match[1] ?? match[2]).trim());
  return { tags, classes, ids };
};

const onThePage = (selector, { tags, classes, ids }) => {
  const last = selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean).pop() ?? '';
  const tag = last.match(/^[a-z][a-z0-9-]*/i)?.[0];
  if(tag && !tags.has(tag.toLowerCase())) return false;
  for(const [, name] of last.matchAll(/\.([a-z0-9_-]+)/gi)) if(!classes.has(name)) return false;
  for(const [, name] of last.matchAll(/#([a-z0-9_-]+)/gi)) if(!ids.has(name)) return false;
  return true;
};

export default (css, html) => {
  const tokens = tokensOf(String(html ?? ''));
  return transformRules(css, {
    selector: prelude => prelude.split(',').map(selector => selector.trim()).filter(selector => selector && onThePage(selector, tokens)).join(', '),
    declarations: body => body.trim(),
  });
};
