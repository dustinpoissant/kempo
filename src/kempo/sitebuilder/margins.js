/*
  A widget's margin: a size for each of its four sides, written as kempo-css classes (m, mx, my, mt, mr, mb, ml, each
  with an h for half, a q for a quarter or an a for auto). '' is none, 'f' a whole space, 'h' half, 'q' a quarter and 'a'
  auto, which centers a narrower widget when it is on both sides.
*/

export const MARGIN_SIDES = ['top', 'right', 'bottom', 'left'];

const SUFFIX = { f: '', h: 'h', q: 'q', a: 'a' };
const SIZE = { '': 'f', h: 'h', q: 'q', a: 'a' };
const LETTER = { top: 't', right: 'r', bottom: 'b', left: 'l' };
const CLASS = /^m([trblxy]?)([hqa]?)$/;

export const cleanMargin = value => Object.fromEntries(MARGIN_SIDES.map(side => [side, ['f', 'h', 'q', 'a'].includes(value?.[side]) ? value[side] : '']));

/* The shortest classes that say it: m for all four sides, my and mx for a pair that matches, then the single sides. */
export const marginClasses = margin => {
  const { top, right, bottom, left } = cleanMargin(margin);
  const classes = [];
  const add = (letter, size) => classes.push(`m${letter}${SUFFIX[size]}`);
  if(top && top === right && top === bottom && top === left) return [`m${SUFFIX[top]}`];
  if(top && top === bottom) add('y', top);
  else {
    if(top) add('t', top);
    if(bottom) add('b', bottom);
  }
  if(left && left === right) add('x', left);
  else {
    if(right) add('r', right);
    if(left) add('l', left);
  }
  return classes;
};

/* Splits a list of classes into the margin they say (null when there is none) and the classes that are something else. */
export const readMarginClasses = classes => {
  const margin = cleanMargin({});
  const rest = [];
  let found = false;
  for(const name of classes){
    const match = CLASS.exec(name);
    if(!match){
      rest.push(name);
      continue;
    }
    found = true;
    const size = SIZE[match[2]];
    const letters = match[1] === 'x' ? ['l', 'r'] : match[1] === 'y' ? ['t', 'b'] : match[1] ? [match[1]] : ['t', 'r', 'b', 'l'];
    for(const side of MARGIN_SIDES) if(letters.includes(LETTER[side])) margin[side] = size;
  }
  return { margin: found ? margin : null, rest };
};

/* Every widget takes a margin, except the pieces of a widget (an accordion's sections, a tab), the server's tags (they are not elements) and what the page does not know. */
export const supportsMargin = definition => !!definition && definition.margin !== false && definition.key !== 'unknown' && definition.type !== 'server' && !definition.server;

/* Adds classes to the first element of a piece of HTML, joining its class attribute when it has one. */
export const addClasses = (html, classes) => {
  const start = html.search(/<[a-zA-Z]/);
  if(start === -1 || !classes.length) return html;
  let end = start + 1;
  let quote = '';
  for(; end < html.length; end++){
    const character = html[end];
    if(quote){
      if(character === quote) quote = '';
    } else if(character === '"' || character === "'") quote = character;
    else if(character === '>') break;
  }
  const tag = html.slice(start, end);
  const existing = /\sclass="([^"]*)"/.exec(tag);
  if(existing){
    const joined = [...existing[1].split(/\s+/).filter(Boolean), ...classes.filter(name => !existing[1].split(/\s+/).includes(name))].join(' ');
    return html.slice(0, start) + tag.replace(existing[0], ` class="${joined}"`) + html.slice(end);
  }
  const closing = tag.endsWith('/') ? ' /' : '';
  return `${html.slice(0, start)}${tag.replace(/\s*\/$/, '')} class="${classes.join(' ')}"${closing}${html.slice(end)}`;
};
