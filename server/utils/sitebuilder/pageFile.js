import { createHash } from 'crypto';
import parseFrontmatter from '../fs/parseFrontmatter.js';

/*
  A page file is a frontmatter comment, a <page template title ...> wrapper and several <content location="..."> blocks.
  These split one into parts and put the parts back together. The hash is of the exact file, because the question the
  builder asks is whether anything at all changed since it last wrote it.
*/

/* Locations that hold code (the page's <head>), not widgets. The scripts location holds Script widgets. */
export const CODE_LOCATIONS = ['head'];

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const hashFile = content => createHash('sha256').update(content, 'utf-8').digest('hex');

const ATTRIBUTE = /([\w:-]+)(?:\s*=\s*"([^"]*)")?/g;

const parseAttributes = text => {
  const attributes = {};
  for(const match of text.matchAll(ATTRIBUTE)){
    attributes[match[1]] = match[2] ?? '';
  }
  return attributes;
};

export const parseContentBlocks = raw => {
  const blocks = [];
  const regex = /<content(?:\s+location="([^"]*)")?\s*>([\s\S]*?)<\/content>/g;
  let match;
  while((match = regex.exec(raw)) !== null){
    blocks.push({ location: match[1] || 'default', content: match[2].trim() });
  }
  return blocks;
};

/*
  Everything the file holds, plus `extra`: anything left over once the frontmatter, the <page> wrapper and the content
  blocks are taken out. A page with something else in it cannot be rebuilt without losing it.
*/
export const parsePageFile = raw => {
  const pageMatch = raw.match(/<page\b([^>]*)>/);
  const pageAttributes = pageMatch ? parseAttributes(pageMatch[1]) : {};
  const blocks = parseContentBlocks(raw);
  const extra = raw
    .replace(/^<!--\s*\n[\s\S]*?\n\s*-->/, '')
    .replace(/<page\b[^>]*>/, '')
    .replace(/<\/page>/, '')
    .replace(/<content(?:\s+location="[^"]*")?\s*>[\s\S]*?<\/content>/g, '')
    .trim();
  return {
    meta: parseFrontmatter(raw),
    pageAttributes,
    template: pageAttributes.template || 'default',
    title: pageAttributes.title || '',
    blocks,
    extra
  };
};

const attributeText = attributes => Object.entries(attributes)
  .map(([name, value]) => `${name}="${String(value).replace(/"/g, '&quot;')}"`)
  .join(' ');

/* blocks: [{ location, content }], empty ones are left out. */
export const composePageFile = ({ meta, pageAttributes, blocks }) => {
  const frontmatter = `<!--\n${Object.entries(meta).map(([key, value]) => `  ${key}: ${value}`).join('\n')}\n-->`;
  const content = blocks
    .filter(block => block.content.trim())
    .map(({ location, content: body }) => (location === 'default' ? `<content>\n${body}\n</content>` : `<content location="${location}">\n${body}\n</content>`))
    .join('\n');
  return `${frontmatter}\n<page ${attributeText(pageAttributes)}>\n${content}\n</page>\n`;
};
