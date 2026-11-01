import { VOID_TAGS, escapeAttribute, escapeText } from './html.js';
import { attributeDefault, coerceAttribute, isDefaultValue } from './attributes.js';

/*
  Turns a widget tree into HTML. The same code makes the page file on the server and the editor's preview in the
  browser, so what you edit is what is served. Pass `editor: true` for the editor's version: every widget's element
  gets a data-sb-id, containers are marked as places widgets can be dropped, and the server's template tags and
  unknown widgets become labelled placeholders (nothing resolves them in an editor).

  ctx: { registry, editor = false, sanitize = html => html }
*/

/*
  Registry
*/

const typeOf = definition => {
  if(definition.type) return definition.type;
  if(definition.server) return 'server';
  return definition.page_component ? 'component' : 'primitive';
};

export const normalizeDefinition = definition => ({
  keywords: [],
  category: 'content',
  ...definition,
  type: typeOf(definition),
  attributes: (definition.attributes || []).map(attribute => ({ ...attribute })),
  slots: (definition.slots || []).map(slot => ({ ...slot }))
});

export const createRegistry = definitions => {
  const byKey = new Map();
  for(const definition of definitions){
    if(definition?.key && !byKey.has(definition.key)) byKey.set(definition.key, normalizeDefinition(definition));
  }
  return {
    get: key => byKey.get(key),
    has: key => byKey.has(key),
    list: () => [...byKey.values()],
    pageComponents: () => [...new Set([...byKey.values()].map(definition => definition.page_component).filter(Boolean))]
  };
};

/* The slots a node has. */
export const slotsOf = definition => definition?.slots || [];

/* Whether a widget may be placed in this slot of this parent (parent is null at the top level). */
export const canContain = (registry, parentNode, slotName, childType) => {
  const child = registry.get(childType);
  if(!child) return false;
  const parentType = parentNode?.type;
  if(child.only_in?.length && !child.only_in.includes(parentType)) return false;
  if(!parentNode) return !child.only_in?.length;
  const parent = registry.get(parentType);
  const slot = slotsOf(parent).find(candidate => candidate.name === slotName);
  if(!slot) return false;
  if(slot.accepts?.length && !slot.accepts.includes(childType)) return false;
  return true;
};

/*
  Helpers the widget definitions use
*/

export const mark = (node, ctx, extra = '') => (ctx.editor ? ` data-sb-id="${escapeAttribute(node.id)}"${extra} tabindex="0"` : '');

/* The attributes of a widget as a string: only what differs from the widget's defaults, so pages stay short. */
export const attributeString = (definition, node, ctx, skip = []) => {
  const parts = [];
  for(const attribute of definition.attributes){
    if(attribute.virtual || skip.includes(attribute.name) || definition.editable === attribute.name) continue;
    const name = attribute.attr || attribute.name;
    const value = coerceAttribute(attribute, node.attrs?.[attribute.name]);
    if(attribute.type === 'boolean'){
      if(attribute.format === 'text'){
        if(value !== !!attributeDefault(attribute)) parts.push(`${name}="${value}"`);
      } else if(value) parts.push(name);
      continue;
    }
    if(isDefaultValue(attribute, value)) continue;
    parts.push(`${name}="${escapeAttribute(value)}"`);
  }
  return `${parts.length ? ' ' : ''}${parts.join(' ')}`;
};

const withSlotAttribute = (html, slot) => (slot === 'default' ? html : html.replace(/^(\s*<[a-zA-Z][\w-]*)/, `$1 slot="${escapeAttribute(slot)}"`));

export const renderSlot = (node, slot, ctx, wrap = true) => {
  const children = node.slots?.[slot] || [];
  return children
    .map((child, index) => {
      const html = renderNode(child, ctx, { index, parent: node, slot });
      return wrap ? withSlotAttribute(html, slot) : html;
    })
    .join('\n');
};

/*
  Rendering
*/

const renderStandard = (node, ctx, definition) => {
  const tag = (ctx.editor && definition.editor_tag) || definition.tag;
  const container = definition.slots.length > 0;
  const attributes = attributeString(definition, node, ctx)
    + mark(node, ctx, definition.editable ? ` data-sb-edit="${escapeAttribute(definition.editable)}"` : '')
    + (ctx.editor && container ? ' data-sb-slot="default"' : '');
  if(VOID_TAGS.has(tag)) return `<${tag}${attributes}>`;
  const text = definition.editable ? escapeText(node.attrs?.[definition.editable] ?? '') : '';
  const children = container ? definition.slots.map(slot => renderSlot(node, slot.name, ctx)).filter(Boolean).join('\n') : '';
  return `<${tag}${attributes}>${text}${children ? `\n${children}\n` : ''}</${tag}>`;
};

export const renderNode = (node, ctx, info = {}) => {
  const definition = ctx.registry.get(node.type) || ctx.registry.get('unknown');
  if(!definition) return '';
  return definition.render ? definition.render(node, ctx, definition, info) : renderStandard(node, ctx, definition);
};

export const renderNodes = (nodes, ctx) => (nodes || []).map((node, index) => renderNode(node, ctx, { index, parent: null, slot: '' })).join('\n');

/* The page-side scripts the widgets in a tree need, each once. */
export const collectScripts = (nodes, registry) => {
  const scripts = new Set();
  const visit = list => {
    for(const node of list || []){
      const definition = registry.get(node.type);
      if(definition?.page_component) scripts.add(definition.page_component);
      for(const children of Object.values(node.slots || {})) visit(children);
    }
  };
  visit(nodes);
  return [...scripts];
};

export const renderScripts = urls => urls.map(url => `<script type="module" src="${escapeAttribute(url)}"></script>`).join('\n');

/* One content location as it is written to the page file: the widgets, then the scripts they need. */
export const renderLocation = (nodes, ctx) => {
  const html = renderNodes(nodes, ctx);
  if(ctx.editor) return html;
  const scripts = renderScripts(collectScripts(nodes, ctx.registry));
  return scripts ? `${html}\n${scripts}` : html;
};
