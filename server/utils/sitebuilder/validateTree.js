import { MAX_DEPTH, canContain, newId } from 'kempo-ui/src/utils/pageTree.js';
import { SIDES, CORNERS, BACKGROUNDS, TEXT_COLOURS, ALIGNS, cleanSides, supportsStyles } from 'kempo-ui/src/utils/styles.js';

/*
  Checks and cleans a widget tree the builder sends, so the server never stores or writes anything the builder could not
  have made. Each node is { id, type, attrs, slots }:

    - the type has to be a widget the site has, and the widget has to be allowed in the slot it is in;
    - only the settings the widget declares are kept, each cleaned by its type (a number is a number within its limits, a
      select is one of its options, an address is one a page may link to or load);
    - ids are kept when they are well formed and not repeated, and made new otherwise;
    - the tree may not be deeper than kempo-ui allows or hold more than MAX_NODES widgets.

  A widget the site does not have now (it belongs to an extension that is turned off) is kept with its settings as they
  are, and its children cleaned, so turning the extension off and on does not lose the page. It is never written on a
  page (the renderer leaves out what it does not know), and it is cleaned by its widget's rules before it is rendered
  again, since this module runs on every render.
*/

const MAX_NODES = 5000;
const MAX_TEXT = 500000;
const MAX_JSON = 200000;
const ID = /^[\w-]{1,64}$/;
const TYPE = /^[a-z][a-z0-9-]{0,59}$/;
const TOKEN = /^[\w-]+$/;
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\.\.?\/)/i;
const ICON_PATH = /^\/(?!\/)[A-Za-z0-9_./-]+\.svg$/;
const COLOUR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const URL_KEYS = new Set(['src', 'href', 'poster', 'url', 'image', 'thumbnail', 'thumb']);

const safeUrl = value => {
  const text = String(value ?? '').trim();
  return text && SAFE_URL.test(text) ? text : '';
};

/* A value kept inside a json setting: plain data only, addresses checked, and not nested more than a few levels. */
const cleanJson = (value, depth = 0, key = '') => {
  if(depth > 8) return null;
  if(Array.isArray(value)) return value.slice(0, 1000).map(item => cleanJson(item, depth + 1, key));
  if(value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 200).map(([name, inner]) => [String(name).slice(0, 100), cleanJson(inner, depth + 1, name)]));
  }
  if(typeof value === 'string') return URL_KEYS.has(key) ? safeUrl(value) : value.slice(0, MAX_TEXT);
  if(typeof value === 'number') return Number.isFinite(value) ? value : null;
  return typeof value === 'boolean' ? value : null;
};

/* One setting's value, cleaned by its type. `undefined` means it is not kept (it is left to its default). */
const cleanValue = (attribute, value) => {
  switch(attribute.type){
    case 'boolean': return value === true || value === 'true';
    case 'number': {
      if(value === '' || value === null || value === undefined) return undefined;
      let number = Number(value);
      if(!Number.isFinite(number)) return undefined;
      if(typeof attribute.min === 'number') number = Math.max(attribute.min, number);
      if(typeof attribute.max === 'number') number = Math.min(attribute.max, number);
      return number;
    }
    case 'select': {
      const text = String(value ?? '');
      const allowed = (attribute.options || []).map(option => String(option.value));
      return !allowed.length || allowed.includes(text) ? text : undefined;
    }
    case 'url':
    case 'file':
    case 'image':
    case 'video':
    case 'audio': return safeUrl(value);
    case 'id': return String(value ?? '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
    case 'color': return COLOUR.test(String(value ?? '').trim()) ? String(value).trim() : '';
    case 'icon': {
      const text = String(value ?? '').trim();
      if(text.startsWith('src:')) return ICON_PATH.test(text.slice(4)) && !text.includes('..') ? text : '';
      return /^[A-Za-z0-9_-]{1,80}$/.test(text) ? text : '';
    }
    case 'json': {
      const cleaned = cleanJson(value);
      return JSON.stringify(cleaned).length <= MAX_JSON ? cleaned : undefined;
    }
    default: return String(value ?? '').slice(0, MAX_TEXT);
  }
};

/* A widget's styles: the same values the page builder offers, each from its list, so a made-up one is dropped. */
const cleanStyles = styles => {
  if(!styles || typeof styles !== 'object' || Array.isArray(styles)) return {};
  const cleaned = {};
  if(styles.margin) cleaned.margin = cleanSides(styles.margin);
  if(styles.padding) cleaned.padding = cleanSides(styles.padding);
  if(BACKGROUNDS.includes(styles.background)) cleaned.background = styles.background;
  if(Number.isFinite(Number(styles.alpha))) cleaned.alpha = Math.min(100, Math.max(0, Math.round(Number(styles.alpha))));
  if(TEXT_COLOURS.includes(styles.textColour)) cleaned.textColour = styles.textColour;
  if(ALIGNS.includes(styles.align)) cleaned.align = styles.align;
  if(Array.isArray(styles.corners)) cleaned.corners = styles.corners.filter(corner => CORNERS.includes(corner));
  if(Array.isArray(styles.sides)) cleaned.sides = styles.sides.filter(side => SIDES.includes(side));
  if(/^[A-Za-z][\w-]*$/.test(styles.id ?? '')) cleaned.id = styles.id;
  if(typeof styles.classes === 'string') cleaned.classes = styles.classes.split(/\s+/).filter(name => TOKEN.test(name)).join(' ');
  return cleaned;
};

const cleanAttributes = (definition, attrs) => {
  const given = attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {};
  const cleaned = {};
  for(const attribute of definition.attributes){
    if(!Object.hasOwn(given, attribute.name)) continue;
    const value = cleanValue(attribute, given[attribute.name]);
    if(value !== undefined) cleaned[attribute.name] = value;
  }
  if(supportsStyles(definition) && given.styles) cleaned.styles = cleanStyles(given.styles);
  return cleaned;
};

/*
  `parent` and `slot` say where the list is, when it is a part of a page (the top level has neither).
  Resolves to [error, nodes].
*/
export default (nodes, registry, { parent = null, slot = '' } = {}) => {
  const context = { count: 0 };
  const clean = (list, parentNode, slotName, depth) => {
    if(!Array.isArray(list)) return [{ code: 400, msg: 'A widget tree must be a list' }, null];
    if(depth > MAX_DEPTH) return [{ code: 400, msg: `Widgets cannot be nested more than ${MAX_DEPTH} levels deep` }, null];
    const result = [];
    const seen = new Set();
    for(const node of list){
      if(!node || typeof node !== 'object') return [{ code: 400, msg: 'A widget must be an object' }, null];
      if(++context.count > MAX_NODES) return [{ code: 400, msg: `A page cannot hold more than ${MAX_NODES} widgets` }, null];
      if(typeof node.type !== 'string' || !TYPE.test(node.type)) return [{ code: 400, msg: `Unknown widget "${String(node.type).slice(0, 50)}"` }, null];
      const definition = registry.get(node.type);
      const parentKnown = !parentNode || registry.has(parentNode.type);
      if(definition && parentKnown && !canContain(registry, parentNode, slotName, node.type)) return [{ code: 400, msg: `${definition.title} cannot go there` }, null];
      const id = typeof node.id === 'string' && ID.test(node.id) && !seen.has(node.id) ? node.id : newId();
      seen.add(id);
      const cleaned = { id, type: node.type, attrs: definition ? cleanAttributes(definition, node.attrs) : (cleanJson(node.attrs) || {}), slots: {} };
      const given = node.slots && typeof node.slots === 'object' && !Array.isArray(node.slots) ? node.slots : {};
      const allowed = definition ? definition.slots.map(candidate => candidate.name) : Object.keys(given).filter(name => /^[a-z][\w-]*$/i.test(name)).slice(0, 20);
      for(const name of allowed){
        if(!given[name]) continue;
        const [error, children] = clean(given[name], cleaned, name, depth + 1);
        if(error) return [error, null];
        cleaned.slots[name] = children;
      }
      result.push(cleaned);
    }
    return [null, result];
  };
  return clean(nodes, parent, slot, 1);
};
