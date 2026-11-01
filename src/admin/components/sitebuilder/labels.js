/* A short description of a node for the widget tree: its widget's name, and what it says or points to. */

const plain = html => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export const hintOf = node => {
  const attrs = node.attrs || {};
  if(node.type === 'markup') return plain(attrs.html).slice(0, 40);
  if(node.type === 'unknown') return attrs.tag ? `<${attrs.tag}>` : '';
  for(const key of ['label', 'title', 'name', 'condition', 'src', 'href', 'image']){
    if(attrs[key]) return String(attrs[key]).slice(0, 40);
  }
  return '';
};

export const titleOf = (registry, node) => registry.get(node.type)?.title || node.type;
