import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { buildRegistry, widgetKey } from '../../../src/kempo/sitebuilder/registry.js';

const TAG = /^[a-z][a-z0-9-]*$/;
const NAME = /^[a-zA-Z][\w-]*$/;
const PATH = /^\/[^\s"'<>]*$/;

/*
  Cleans one extension's `page_widgets` entry. A widget that is not valid is left out (and the reason returned), so one
  bad declaration cannot stop a page from opening.
*/
export const normalizeExtensionWidget = (owner, definition) => {
  if(!definition || typeof definition !== 'object') return [{ code: 400, msg: 'A page widget must be an object' }, null];
  const { key, title, tag } = definition;
  if(typeof key !== 'string' || !NAME.test(key)) return [{ code: 400, msg: 'A page widget needs a key' }, null];
  if(typeof title !== 'string' || !title.trim()) return [{ code: 400, msg: `Page widget "${key}" needs a title` }, null];
  if(typeof tag !== 'string' || !TAG.test(tag)) return [{ code: 400, msg: `Page widget "${key}" needs a tag` }, null];
  for(const field of ['page_component', 'editor_component', 'settings_component']){
    if(definition[field] !== undefined && !PATH.test(String(definition[field]))) return [{ code: 400, msg: `Page widget "${key}" has an invalid ${field}` }, null];
  }
  if(!!definition.settings_component !== !!definition.settings_tag) return [{ code: 400, msg: `Page widget "${key}" needs both settings_component and settings_tag, or neither` }, null];
  if(definition.settings_tag && !TAG.test(definition.settings_tag)) return [{ code: 400, msg: `Page widget "${key}" has an invalid settings_tag` }, null];
  if(tag.includes('-') && !definition.page_component) return [{ code: 400, msg: `Page widget "${key}" is a component and needs a page_component` }, null];
  const attributes = [];
  for(const attribute of definition.attributes || []){
    if(!attribute || !NAME.test(attribute.name || '')) return [{ code: 400, msg: `Page widget "${key}" has an attribute without a valid name` }, null];
    attributes.push({
      name: attribute.name,
      attr: attribute.attr && NAME.test(attribute.attr) ? attribute.attr : undefined,
      type: attribute.type || 'string',
      label: attribute.label || attribute.name,
      hint: attribute.hint,
      default: attribute.default,
      options: Array.isArray(attribute.options) ? attribute.options.map(option => ({ value: String(option.value), label: String(option.label ?? option.value) })) : undefined,
      min: attribute.min,
      max: attribute.max,
      format: attribute.format === 'text' ? 'text' : undefined,
      picker: ['image', 'video', 'audio'].includes(attribute.picker) ? attribute.picker : undefined
    });
  }
  const slots = (definition.slots || []).filter(slot => slot && NAME.test(slot.name || '')).map(slot => ({ name: slot.name, label: slot.label || slot.name, accepts: Array.isArray(slot.accepts) ? slot.accepts : undefined }));
  return [null, {
    key: widgetKey(owner, key),
    owner,
    title: title.trim(),
    description: definition.description || '',
    icon: definition.icon || 'extension',
    iconSrc: definition.iconSrc,
    category: typeof definition.category === 'string' && definition.category.trim() ? definition.category.trim().toLowerCase() : 'content',
    category_title: typeof definition.category_title === 'string' && definition.category_title.trim() ? definition.category_title.trim() : undefined,
    keywords: Array.isArray(definition.keywords) ? definition.keywords.map(String) : [],
    tag,
    page_component: definition.page_component,
    editor_component: definition.editor_component,
    editor_tag: definition.editor_tag && TAG.test(definition.editor_tag) ? definition.editor_tag : undefined,
    settings_component: definition.settings_component,
    settings_tag: definition.settings_tag,
    editable: definition.editable,
    only_in: Array.isArray(definition.only_in) ? definition.only_in : undefined,
    attributes,
    slots
  }];
};

export const loadExtensionWidgets = async () => {
  const rows = await db.select({ name: extension.name, kempo: extension.kempo }).from(extension).where(eq(extension.enabled, true));
  const widgets = [];
  const seen = new Set();
  for(const row of rows){
    for(const definition of row.kempo?.page_widgets || []){
      const [error, widget] = normalizeExtensionWidget(row.name, definition);
      if(error){
        console.warn(`[${row.name}] page widget skipped: ${error.msg}`);
        continue;
      }
      if(widget.tag.includes('-') && seen.has(widget.tag)){
        console.warn(`[${row.name}] page widget "${definition.key}" skipped: another widget already uses <${widget.tag}>`);
        continue;
      }
      seen.add(widget.tag);
      widgets.push(widget);
    }
  }
  return widgets;
};

/* The registry for this site: kempo's widgets and every enabled extension's. */
export default async () => buildRegistry(await loadExtensionWidgets());
