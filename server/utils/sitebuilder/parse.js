import { parseDocument } from 'htmlparser2';

/*
  Parsing for the rebuild and the comparison. Elements keep their position in the source (startIndex and endIndex), so a
  piece of the page that is kept as it was can be cut straight out of the original text.
*/

export const parse = html => {
  const document = parseDocument(html, {
    recognizeSelfClosing: true,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
    withStartIndices: true,
    withEndIndices: true
  });
  return { document, source: html };
};

export const isElement = node => node.type === 'tag' || node.type === 'script' || node.type === 'style';

export const isText = node => node.type === 'text';

export const isComment = node => node.type === 'comment' || node.type === 'directive';

export const isBlank = node => isText(node) && !node.data.trim();

export const sourceOf = (source, first, last = first) => source.slice(first.startIndex, last.endIndex + 1);

export const classesOf = element => String(element.attribs?.class || '').split(/\s+/).filter(Boolean);

export const elementChildren = element => element.children.filter(isElement);
