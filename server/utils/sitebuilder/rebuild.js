import { createNode, MAX_DEPTH } from '../../../src/kempo/sitebuilder/nodes.js';
import { INLINE_TAGS, TEXT_BLOCK_TAGS } from '../../../src/kempo/sitebuilder/html.js';
import { coerceAttribute } from '../../../src/kempo/sitebuilder/attributes.js';
import { BUTTON_COLORS, GALLERY_SPANS, GROUP_ELEMENTS, SPACER_HEIGHTS, groupAttributes } from '../../../src/kempo/sitebuilder/widgets.js';
import { parse, isElement, isText, isComment, isBlank, sourceOf, classesOf, elementChildren } from './parse.js';
import { sameMeaning } from './normalize.js';
import { sanitizeMarkup } from './sanitize.js';
import { cleanWidth } from '../../../src/kempo/sitebuilder/tables.js';
import { readMarginClasses, supportsMargin } from '../../../src/kempo/sitebuilder/margins.js';
import { readCode } from '../../../src/kempo/sitebuilder/scriptCode.js';

/*
  Builds a widget tree from the HTML of a content location: the opposite of rendering. Each known tag becomes its
  widget, a run of text tags becomes one Markup widget, and the server's template tags become server widgets. Anything
  that cannot be a widget (a script, an iframe, a tag nothing knows) stops the rebuild, and the page is edited as code.

  The rebuild is never trusted on its own: callers render the tree back and compare it with the HTML, so anything the
  rebuild dropped shows up as a difference.
*/

class RebuildError extends Error {}

const fail = message => {
  throw new RebuildError(message);
};

const textOf = element => {
  if(element.children.some(child => !isText(child) && !isComment(child))) fail(`<${element.name}> holds more than text`);
  return element.children.filter(isText).map(child => child.data).join('').replace(/\s+/g, ' ').trim();
};

const attribute = (element, name) => element.attribs?.[name];

/* Reads the declared attributes of a widget off an element. */
const readAttributes = (definition, element) => {
  const attrs = {};
  for(const declared of definition.attributes){
    if(declared.virtual) continue;
    const name = declared.attr || declared.name;
    const raw = element.attribs?.[name];
    if(declared.type === 'boolean'){
      attrs[declared.name] = declared.format === 'text'
        ? (raw === undefined ? declared.default === true : raw === 'true')
        : raw !== undefined;
      continue;
    }
    if(raw === undefined) continue;
    attrs[declared.name] = coerceAttribute(declared, raw);
  }
  return attrs;
};

const findDefinition = (ctx, key) => ctx.registry.get(key);

const readSlot = (children, ctx, depth) => {
  if(depth > MAX_DEPTH) fail('Widgets are nested too deeply');
  const nodes = [];
  let run = [];
  const flush = () => {
    const meaningful = run.filter(node => !isBlank(node));
    run = [];
    if(!meaningful.length) return;
    const html = sourceOf(ctx.source, meaningful[0], meaningful[meaningful.length - 1]).trim();
    if(!sameMeaning(html, sanitizeMarkup(html))) fail('Text holds something the editor would change');
    nodes.push(createNode('markup', { html }));
  };
  for(const child of children){
    if(isComment(child)) continue;
    if(isText(child)){
      run.push(child);
      continue;
    }
    if(!isElement(child)) continue;
    const node = readElement(child, ctx, depth);
    if(node === undefined) continue;
    if(node === null){
      run.push(child);
      continue;
    }
    flush();
    nodes.push(node);
  }
  flush();
  return nodes;
};

/* The children of a container, read into the slots its definition declares. */
const readSlots = (definition, element, ctx, depth) => {
  const slots = {};
  const named = definition.slots.filter(slot => slot.name !== 'default');
  if(!named.length){
    if(definition.slots.length) slots.default = readSlot(element.children, ctx, depth + 1);
    return slots;
  }
  const buckets = Object.fromEntries(definition.slots.map(slot => [slot.name, []]));
  for(const child of element.children){
    if(isElement(child) && attribute(child, 'slot') && buckets[attribute(child, 'slot')]){
      const clone = { ...child, attribs: { ...child.attribs } };
      delete clone.attribs.slot;
      buckets[attribute(child, 'slot')].push(clone);
    } else {
      buckets.default?.push(child);
    }
  }
  for(const [name, children] of Object.entries(buckets)){
    slots[name] = readSlot(children, ctx, depth + 1);
  }
  return slots;
};

const generic = (definition, element, ctx, depth) => {
  const attrs = readAttributes(definition, element);
  if(definition.editable) attrs[definition.editable] = textOf(element);
  return createNode(definition.key, attrs, readSlots(definition, element, ctx, depth));
};

/*
  Widgets that are more than one tag, or whose settings are in classes
*/

const BOX_PROPERTIES = { background: 'background', color: 'color', 'border-radius': 'radius' };

/* The settings in a Text widget's box (what markupStyle writes), or null when the style holds anything else. */
const boxSettings = element => {
  const attrs = {};
  for(const declaration of String(attribute(element, 'style') || '').split(';')){
    if(!declaration.trim()) continue;
    const [name, ...rest] = declaration.split(':');
    const key = BOX_PROPERTIES[name.trim().toLowerCase()];
    if(!key) return null;
    const value = rest.join(':').trim();
    attrs[key] = key === 'radius' ? Number.parseFloat(value) : coerceAttribute({ type: 'color' }, value);
    if(attrs[key] === '' || Number.isNaN(attrs[key])) return null;
  }
  return Object.keys(attrs).length ? attrs : null;
};

const SPACING_PROPERTIES = { 'margin-top': 'above', 'margin-bottom': 'below' };

/* The space above and below a divider (what the widget writes), or false when its style holds anything else. */
const readSpacing = (element, attrs) => {
  for(const declaration of String(attribute(element, 'style') || '').split(';')){
    if(!declaration.trim()) continue;
    const [name, ...rest] = declaration.split(':');
    const key = SPACING_PROPERTIES[name.trim().toLowerCase()];
    const length = /^(\d+(?:\.\d+)?)(rem|px)$/.exec(rest.join(':').trim());
    if(!key || !length) return false;
    const preset = Object.entries(SPACER_HEIGHTS).find(([, height]) => height === `${length[1]}${length[2]}`);
    if(preset) attrs[key] = preset[0];
    else if(length[2] === 'px'){
      attrs[key] = 'custom';
      attrs[`${key}Height`] = Number(length[1]);
    } else return false;
  }
  return true;
};

const readers = {
  markup: (definition, element, ctx) => {
    const inner = element.children.filter(child => !isComment(child) && !isBlank(child));
    const html = inner.length ? sourceOf(ctx.source, inner[0], inner[inner.length - 1]).trim() : '';
    if(html && !sameMeaning(html, sanitizeMarkup(html))) fail('Text holds something the editor would change');
    return createNode('markup', { html, ...boxSettings(element) });
  },
  image: (definition, element) => {
    const attrs = readAttributes(definition, element);
    const classes = classesOf(element);
    const style = String(attribute(element, 'style') || '');
    const ratio = /aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/.exec(style);
    if(ratio) attrs.ratio = `${ratio[1]}/${ratio[2]}`;
    if(/object-fit:\s*contain/.test(style)) attrs.fit = 'contain';
    if(classes.includes('full')) attrs.full = true;
    if(classes.includes('round')) attrs.rounded = 'round';
    else if(classes.includes('r')) attrs.rounded = 'small';
    return createNode('image', attrs);
  },
  'html-block': (definition, element, ctx) => {
    const html = element.children.length ? sourceOf(ctx.source, element.children[0], element.children[element.children.length - 1]) : '';
    return createNode('html-block', { html });
  },
  divider: (definition, element) => {
    const attrs = {};
    return createNode('divider', readSpacing(element, attrs) ? attrs : {});
  },
  fragment: (definition, element) => createNode('fragment', { name: attribute(element, 'name') || '' }),
  location: (definition, element) => createNode('location', { name: attribute(element, 'name') || '' }),
  conditional: (definition, element, ctx, depth) => createNode('conditional', { condition: attribute(element, 'condition') || '' }, readSlots(definition, element, ctx, depth)),
  repeat: (definition, element, ctx, depth) => createNode('repeat', { in: attribute(element, 'in') || '', as: attribute(element, 'as') || 'item' }, readSlots(definition, element, ctx, depth)),

  button: (definition, element) => {
    const classes = classesOf(element).filter(name => name !== 'btn');
    const color = classes.find(name => BUTTON_COLORS.includes(name)) || '';
    if(element.name === 'button') return createNode('button', { kind: 'button', id: attribute(element, 'id') || '', label: textOf(element), color: classesOf(element).find(name => BUTTON_COLORS.includes(name)) || '' });
    return createNode('button', { href: attribute(element, 'href') || '', ...(attribute(element, 'target') === '_blank' ? { newTab: true } : {}), label: textOf(element), color });
  },
  file: (definition, element) => createNode('file', { href: attribute(element, 'href') || '', label: textOf(element) }),

  table: (definition, element) => {
    const rowsOf = parent => elementChildren(parent).filter(child => child.name === 'tr');
    const sections = elementChildren(element);
    const head = sections.find(child => child.name === 'thead');
    const bodies = sections.filter(child => child.name === 'tbody');
    const loose = sections.filter(child => child.name === 'tr');
    const readRow = row => elementChildren(row).filter(cell => cell.name === 'td' || cell.name === 'th').map(textOf);
    const headRows = head ? rowsOf(head).map(readRow) : [];
    if(headRows.length > 1) fail('A table heading has more than one row');
    const bodyRows = [...bodies.flatMap(body => rowsOf(body)), ...loose].map(readRow);
    const rows = [...headRows, ...bodyRows];
    const width = Math.max(1, ...rows.map(row => row.length));
    const group = sections.find(child => child.name === 'colgroup');
    const widths = group ? elementChildren(group).filter(col => col.name === 'col').map(col => {
      const match = /^\s*width:\s*([^;]+?)\s*$/.exec(String(attribute(col, 'style') || ''));
      return match ? cleanWidth(match[1]) : '';
    }) : [];
    return createNode('table', { header: headRows.length === 1, rows: rows.map(row => [...row, ...Array(width - row.length).fill('')]), widths });
  },

  row: (definition, element, ctx, depth) => {
    if(element.children.some(child => isText(child) && !isBlank(child))) return null;
    const columns = elementChildren(element).map(column => {
      const classes = classesOf(column);
      const sizes = classes.filter(name => /^span-([1-9]|1[0-2])$/.test(name));
      const fill = classes.includes('col');
      const stack = classes.includes('m-span-12');
      if(column.name !== 'div' || sizes.length + (fill ? 1 : 0) !== 1 || classes.length !== 1 + (stack ? 1 : 0)) return null;
      return { column, size: sizes[0]?.slice(5) || '', stack };
    });
    if(columns.some(column => !column)) return null;
    return createNode('row', {}, { default: columns.map(({ column, size, stack }) => createNode('column', { ...(size ? { size } : {}), stack }, { default: readSlot(column.children, ctx, depth + 2) })) });
  },

  /* One viewer is one picture; a row of viewers is a gallery, with as many photos per row as the first one's width says. */
  'photo-viewer': (definition, element) => {
    const gallery = element.name !== 'k-photo-viewer';
    const viewers = gallery ? elementChildren(element) : [element];
    const images = viewers.map(viewer => ({ src: attribute(viewer, 'src') || '', alt: attribute(viewer, 'alt') || '' }));
    const span = gallery ? Number(classesOf(viewers[0]).find(name => /^span-\d+$/.test(name))?.slice(5)) : 0;
    const columns = Object.entries(GALLERY_SPANS).find(([, value]) => value === span)?.[0];
    return createNode('photo-viewer', { images, ...(columns ? { columns } : {}) });
  },

  spacer: (definition, element) => {
    const classes = classesOf(element);
    const inner = elementChildren(element);
    if(element.children.some(child => !isComment(child) && !isBlank(child) && !isElement(child))) return null;
    const height = /^\s*height:\s*(\d+(?:\.\d+)?)(rem|px)\s*$/.exec(String(attribute(element, 'style') || ''));
    if(height && !inner.length && element.children.every(child => isComment(child) || isBlank(child))){
      const preset = Object.entries(SPACER_HEIGHTS).find(([, value]) => value === `${height[1]}${height[2]}`);
      if(preset) return createNode('spacer', { size: preset[0] });
      if(height[2] === 'px') return createNode('spacer', { size: 'custom', height: Number(height[1]) });
      return null;
    }
    if(classes.length === 1 && classes[0] === 'pyh' && !inner.length) return createNode('spacer', { size: 'small' });
    if(classes.length === 1 && classes[0] === 'py' && !inner.length) return createNode('spacer', { size: 'medium' });
    if(classes.length === 1 && classes[0] === 'py' && inner.length === 1 && inner[0].name === 'div' && classesOf(inner[0]).join(' ') === 'py' && !elementChildren(inner[0]).length) return createNode('spacer', { size: 'large' });
    return null;
  },

  group: (definition, element, ctx, depth) => createNode('group', { ...groupAttributes(classesOf(element)), element: element.name }, { default: readSlot(element.children, ctx, depth + 1) }),

  accordion: (definition, element, ctx, depth) => {
    const items = [];
    const children = elementChildren(element);
    if(element.children.some(child => isText(child) && !isBlank(child))) fail('An accordion holds more than sections');
    for(let index = 0; index < children.length; index += 2){
      const header = children[index];
      const panel = children[index + 1];
      if(header?.name !== 'k-accordion-header' || panel?.name !== 'k-accordion-panel' || attribute(header, 'for-panel') !== attribute(panel, 'name')) fail('An accordion section is not a header followed by its panel');
      items.push(createNode('accordion-item', { title: textOf(header) }, { default: readSlot(panel.children, ctx, depth + 2) }));
    }
    return createNode('accordion', { multiple: attribute(element, 'multiple') !== undefined }, { default: items });
  },

  tabs: (definition, element, ctx, depth) => {
    const items = [];
    const children = elementChildren(element);
    if(element.children.some(child => isText(child) && !isBlank(child))) fail('Tabs hold more than tabs');
    for(let index = 0; index < children.length; index += 2){
      const tab = children[index];
      const content = children[index + 1];
      if(tab?.name !== 'k-tab' || content?.name !== 'k-tab-content' || attribute(tab, 'for') !== attribute(content, 'name')) fail('A tab is not a tab followed by its content');
      items.push(createNode('tab-item', { label: textOf(tab) }, { default: readSlot(content.children, ctx, depth + 2) }));
    }
    return createNode('tabs', {}, { default: items });
  }
};

/* Which primitive matches this element, by key; the first that returns a node wins. */
const primitiveMatchers = [
  ['markup', element => element.name === 'div' && (attribute(element, 'data-sb-text') !== undefined || (attribute(element, 'style') !== undefined && !!boxSettings(element))) && classesOf(element).every(name => name === 'p')],
  ['table', element => element.name === 'table'],
  ['divider', element => element.name === 'hr'],
  ['image', element => element.name === 'img'],
  ['button', element => (element.name === 'a' && classesOf(element).includes('btn')) || (element.name === 'button' && attribute(element, 'type') === 'button')],
  ['file', element => element.name === 'a' && attribute(element, 'download') !== undefined],
  ['html-block', element => element.name === 'div' && attribute(element, 'data-sb-html') !== undefined],
  ['photo-viewer', element => element.name === 'div' && classesOf(element).includes('row') && elementChildren(element).length > 1 && elementChildren(element).every(child => child.name === 'k-photo-viewer')],
  ['row', element => element.name === 'div' && classesOf(element).includes('row')],
  ['spacer', element => element.name === 'div' && (/^(pyh?)$/.test(String(attribute(element, 'class') || '')) || /^\s*height:/.test(String(attribute(element, 'style') || '')))],
  ['group', element => GROUP_ELEMENTS.includes(element.name)]
];

const SERVER_TAGS = { fragment: 'fragment', location: 'location', if: 'conditional', foreach: 'repeat' };

/*
  Returns a node, undefined (the element is dropped: the scripts the renderer adds), or null (not a widget: it belongs
  to a run of text).
*/
function readElement(element, ctx, depth){
  /* The margin classes are read off first, so what is left is read as the widget itself. */
  const { margin, rest } = readMarginClasses(classesOf(element));
  if(margin){
    const clone = { ...element, attribs: { ...element.attribs } };
    if(rest.length) clone.attribs.class = rest.join(' ');
    else delete clone.attribs.class;
    const node = readElementPlain(clone, ctx, depth);
    if(node && supportsMargin(ctx.registry.get(node.type))){
      node.attrs = { ...node.attrs, margin };
      return node;
    }
  }
  return readElementPlain(element, ctx, depth);
}

function readElementPlain(element, ctx, depth){
  if(depth > MAX_DEPTH) fail('Widgets are nested too deeply');
  if(element.name === 'script'){
    if(attribute(element, 'type') === 'module' && ctx.scripts.has(attribute(element, 'src')) && !element.children.length) return undefined;
    /* A script is the Script widget: a file (src), or JavaScript written in it, never both. */
    const body = element.children.filter(isText).map(child => child.data).join('');
    if(element.children.some(child => !isText(child) && !isComment(child))) fail('A script holds more than text');
    const node = generic(findDefinition(ctx, 'script'), element, ctx, depth);
    if(body.trim()){
      if(attribute(element, 'src') !== undefined) fail('A script has a file or JavaScript, not both');
      node.attrs.code = readCode(body);
    }
    return node;
  }
  if(element.name === 'style' || element.name === 'iframe' || element.name === 'link' || element.name === 'meta') fail(`The page holds <${element.name}>`);

  const server = SERVER_TAGS[element.name];
  if(server) return readers[server](findDefinition(ctx, server), element, ctx, depth);

  const byTag = ctx.byTag.get(element.name);
  if(byTag && (byTag.type === 'component' || element.name.includes('-'))){
    const reader = readers[byTag.key];
    return reader ? reader(byTag, element, ctx, depth) : generic(byTag, element, ctx, depth);
  }

  for(const [key, matches] of primitiveMatchers){
    if(!matches(element)) continue;
    const node = readers[key]?.(findDefinition(ctx, key), element, ctx, depth);
    if(node) return node;
  }

  const primitive = ctx.byTag.get(element.name);
  if(primitive && primitive.type === 'primitive' && !ctx.coreKeys.has(primitive.key)) return generic(primitive, element, ctx, depth);

  if(TEXT_BLOCK_TAGS.has(element.name) || INLINE_TAGS.has(element.name)) return null;
  if(element.name.includes('-')) return createNode('unknown', { tag: element.name, html: sourceOf(ctx.source, element) });
  fail(`<${element.name}> cannot be a widget`);
  return null;
}

const CORE = new Set(['markup', 'image', 'video', 'audio', 'file', 'photo-viewer', 'hero', 'embed', 'group', 'row', 'column', 'spacer', 'divider', 'button', 'table', 'social-icons', 'accordion', 'accordion-item', 'tabs', 'tab-item', 'card', 'content-slider', 'show-more', 'icon', 'fragment', 'location', 'conditional', 'repeat', 'unknown']);

/*
  Resolves to [null, nodes], or [{ code: 422, msg }, null] when the HTML cannot be a tree.
*/
export default (html, registry) => {
  const { document, source } = parse(html);
  const byTag = new Map();
  for(const definition of registry.list()){
    if(definition.tag && !byTag.has(definition.tag) && !['group', 'row', 'column', 'spacer', 'divider', 'image', 'file', 'button', 'table'].includes(definition.key)) byTag.set(definition.tag, definition);
  }
  const ctx = { registry, source, byTag, scripts: new Set(registry.pageComponents()), coreKeys: CORE };
  try {
    return [null, readSlot(document.children, ctx, 1)];
  } catch(error) {
    if(error instanceof RebuildError) return [{ code: 422, msg: error.message }, null];
    throw error;
  }
};
