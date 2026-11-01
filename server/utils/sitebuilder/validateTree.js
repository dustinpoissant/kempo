import { MAX_DEPTH, newId } from '../../../src/kempo/sitebuilder/nodes.js';
import { coerceAttribute } from '../../../src/kempo/sitebuilder/attributes.js';
import { slotsOf, canContain } from '../../../src/kempo/sitebuilder/render.js';
import { resolveEmbed } from '../../../src/kempo/sitebuilder/embedProviders.js';
import { sanitizeMarkup, sanitizeText } from './sanitize.js';
import { safeUrl } from '../../../src/kempo/sitebuilder/html.js';
import { columnWidths } from '../../../src/kempo/sitebuilder/tables.js';
import { cleanMargin, supportsMargin } from '../../../src/kempo/sitebuilder/margins.js';

/*
  Everything the editor sends is checked here before it is stored or written to a page. The server cannot assume the
  tree came from the editor: it checks every widget exists, every attribute is one the widget declares and has a clean
  value, every widget is in a place it may go, and that the nesting is not runaway. What does not pass is fixed when
  there is an obvious fix (a value cleaned, an unknown attribute dropped) and refused when there is not.
*/

const MAX_NODES = 5000;
const MAX_TABLE_ROWS = 200;
const MAX_TABLE_COLUMNS = 50;
const MAX_PHOTOS = 200;
const ID = /^[\w-]{1,64}$/;
const VARIABLE = /^!?[\w.]{0,100}$/;
const NAME = /^[\w./:-]{0,200}$/;

/*
  Widgets whose settings are not plain attributes. Each cleans its own virtual attributes.
*/
const virtual = {
  markup: (attrs, context) => ({ html: sanitizeMarkup(attrs.html) }),
  table: attrs => {
    const rows = Array.isArray(attrs.rows) ? attrs.rows.slice(0, MAX_TABLE_ROWS) : [];
    const width = Math.min(MAX_TABLE_COLUMNS, Math.max(1, ...rows.map(row => (Array.isArray(row) ? row.length : 0))));
    return {
      rows: rows.map(row => Array.from({ length: width }, (_, index) => sanitizeText(Array.isArray(row) ? row[index] : ''))),
      widths: columnWidths(attrs.widths, width)
    };
  },
  'html-block': attrs => ({ html: String(attrs.html ?? '') }),
  script: attrs => ({ code: String(attrs.code ?? '') }),
  'photo-viewer': attrs => ({
    images: (Array.isArray(attrs.images) ? attrs.images : []).slice(0, MAX_PHOTOS)
      .map(image => ({ src: safeUrl(image?.src), alt: sanitizeText(image?.alt) }))
      .filter(image => image.src)
  }),
  unknown: (attrs, context) => {
    const html = String(attrs.html ?? '');
    return {
      tag: /^[a-z][a-z0-9-]*$/.test(String(attrs.tag)) ? String(attrs.tag) : 'element',
      html: context.preserved.has(html) ? html : sanitizeMarkup(html)
    };
  }
};

/* Server widgets and Embed take values the page will pass to something else, so they get a stricter check. */
const strict = {
  fragment: attrs => ({ name: NAME.test(attrs.name) ? attrs.name : '' }),
  location: attrs => ({ name: NAME.test(attrs.name) ? attrs.name : '' }),
  conditional: attrs => ({ condition: VARIABLE.test(attrs.condition) ? attrs.condition : '' }),
  repeat: attrs => ({ in: /^[\w.]{0,100}$/.test(attrs.in) ? attrs.in : '', as: /^[\w]{1,50}$/.test(attrs.as) ? attrs.as : 'item' }),
  embed: attrs => ({ src: attrs.src && resolveEmbed(attrs.src) ? attrs.src : '' })
};

const cleanAttributes = (definition, attrs, context) => {
  const cleaned = {};
  for(const declared of definition.attributes){
    if(declared.virtual) continue;
    if(attrs[declared.name] === undefined) continue;
    cleaned[declared.name] = coerceAttribute(declared, attrs[declared.name]);
  }
  Object.assign(cleaned, virtual[definition.key]?.(attrs, context) || {}, strict[definition.key]?.({ ...cleaned, ...attrs }) || {});
  if(supportsMargin(definition) && attrs.margin){
    const margin = cleanMargin(attrs.margin);
    if(Object.values(margin).some(Boolean)) cleaned.margin = margin;
  }
  return cleaned;
};

/*
  Resolves to [null, nodes] with the cleaned tree, or [{ code: 400, msg }, null].
  `preserved` is the set of unknown-widget HTML the page already holds: such a block is kept as it was and cannot be
  authored, so anything else sent in an unknown widget is cleaned like text.
*/
export default (nodes, registry, { preserved = new Set(), parent = null, slot = '' } = {}) => {
  const context = { preserved, count: 0 };
  const clean = (list, parentNode, slotName, depth) => {
    if(!Array.isArray(list)) return [{ code: 400, msg: 'A widget tree must be a list' }, null];
    if(depth > MAX_DEPTH) return [{ code: 400, msg: `Widgets cannot be nested more than ${MAX_DEPTH} levels deep` }, null];
    const result = [];
    const seen = new Set();
    for(const node of list){
      if(!node || typeof node !== 'object') return [{ code: 400, msg: 'A widget must be an object' }, null];
      if(++context.count > MAX_NODES) return [{ code: 400, msg: `A page cannot hold more than ${MAX_NODES} widgets` }, null];
      const definition = registry.get(node.type);
      if(!definition) return [{ code: 400, msg: `Unknown widget "${String(node.type).slice(0, 50)}"` }, null];
      if(!canContain(registry, parentNode, slotName, node.type)) return [{ code: 400, msg: `${definition.title} cannot go there` }, null];
      const id = typeof node.id === 'string' && ID.test(node.id) && !seen.has(node.id) ? node.id : newId();
      seen.add(id);
      const attrs = cleanAttributes(definition, node.attrs && typeof node.attrs === 'object' ? node.attrs : {}, context);
      const cleaned = { id, type: node.type, attrs, slots: {} };
      const allowed = slotsOf(definition);
      const given = node.slots && typeof node.slots === 'object' ? node.slots : {};
      for(const name of Object.keys(given)){
        if(!allowed.some(candidate => candidate.name === name) && given[name]?.length) return [{ code: 400, msg: `${definition.title} has no "${name}" slot` }, null];
      }
      for(const { name } of allowed){
        const [error, children] = clean(given[name] || [], cleaned, name, depth + 1);
        if(error) return [error, null];
        if(children.length) cleaned.slots[name] = children;
      }
      result.push(cleaned);
    }
    return [null, result];
  };
  return clean(nodes, parent, slot, 1);
};
