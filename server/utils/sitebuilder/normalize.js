import { parse, isComment, isElement, isText } from './parse.js';
import { INLINE_TAGS } from '../../../src/kempo/sitebuilder/html.js';

/*
  Two pieces of HTML mean the same thing when they have the same tags, the same attributes and the same text. How they
  are written does not matter: whitespace between and around blocks, the order of attributes and classes, and the
  quote style around an attribute are all ignored. Whitespace that changes how the page looks is kept: inside <pre>
  and <textarea>, and the single space between inline elements and words.
*/

const KEEP_WHITESPACE = new Set(['pre', 'textarea', 'script', 'style']);

const isBlockElement = node => isElement(node) && !INLINE_TAGS.has(node.name);

const attributesOf = element => Object.entries(element.attribs || {})
  .map(([name, value]) => {
    if(name === 'class') return ['class', [...new Set(String(value).split(/\s+/).filter(Boolean))].sort().join(' ')];
    return [name, value];
  })
  .filter(([name, value]) => !(name === 'class' && !value))
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const canonicalChildren = (children, keepWhitespace) => {
  const items = children.filter(child => !isComment(child));
  const parts = [];
  items.forEach((child, index) => {
    if(isText(child)){
      let text = keepWhitespace ? child.data : child.data.replace(/\s+/g, ' ');
      if(!keepWhitespace){
        const previous = items[index - 1];
        const next = items[index + 1];
        if(!previous || isBlockElement(previous)) text = text.replace(/^ /, '');
        if(!next || isBlockElement(next)) text = text.replace(/ $/, '');
      }
      if(text) parts.push(JSON.stringify(text));
      return;
    }
    if(!isElement(child)) return;
    const attributes = attributesOf(child).map(([name, value]) => ` ${name}=${JSON.stringify(value)}`).join('');
    const inside = canonicalChildren(child.children || [], keepWhitespace || KEEP_WHITESPACE.has(child.name));
    parts.push(`<${child.name}${attributes}>${inside}</${child.name}>`);
  });
  return parts.join('');
};

export const canonical = html => canonicalChildren(parse(html).document.children, false);

export const sameMeaning = (a, b) => canonical(a) === canonical(b);
