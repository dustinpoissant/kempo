import { eq } from 'drizzle-orm';
import { join } from 'path';
import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import readKempoConfig from '../extensions/readKempoConfig.js';
import { widgets, addWidget, registryOf } from 'kempo-ui/src/utils/pageWidgets.js';
import { STYLE_PARTS } from 'kempo-ui/src/utils/styles.js';
import serverWidgets from '../../../src/kempo/pagebuilder/serverWidgets.js';
import coreWidgets from '../../../src/kempo/pagebuilder/coreWidgets.js';
import rawHtml from '../../../src/kempo/pagebuilder/rawHtml.js';

const TAG = /^[a-z][a-z0-9-]*$/;
const NAME = /^[a-zA-Z][\w-]*$/;
const PATH = /^\/[^\s"'<>]*$/;
const SETTING_FIELDS = ['name', 'attr', 'type', 'label', 'hint', 'default', 'options', 'min', 'max', 'format', 'virtual', 'when', 'beside'];

/*
  The widgets a page can use, on the server: the ones kempo-ui ships, kempo's own server widgets, and the ones the
  enabled extensions declare in `page_widgets`. kempo-ui keeps one list (`widgets`) for the whole process, so this
  module keeps what is in it up to date: the built-in names are fixed when it loads, and the extensions' widgets are
  taken out and put back whenever the registry is asked for.
*/
const BUILT_IN = new Set(widgets.map(widget => widget.name));

for(const config of [...serverWidgets, ...coreWidgets]){
  addWidget(config);
  BUILT_IN.add(config.name);
}

addWidget({ ...widgets.find(widget => widget.name === 'html'), ...rawHtml });

/* A widget's name on pages: the extension's name and the widget's key, in lowercase kempo-ui form (my-ext-callout). */
export const widgetName = (owner, key) => `${owner}-${key}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

/*
  Cleans one extension's `page_widgets` entry into a widget definition for kempo-ui's page builder. A widget that is
  not valid is left out (and the reason returned), so one bad declaration cannot stop a page from opening.
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
  if(!!definition.editor_component !== !!definition.editor_tag) return [{ code: 400, msg: `Page widget "${key}" needs both editor_component and editor_tag, or neither` }, null];
  for(const field of ['settings_tag', 'editor_tag']){
    if(definition[field] && !TAG.test(definition[field])) return [{ code: 400, msg: `Page widget "${key}" has an invalid ${field}` }, null];
  }
  if(tag.includes('-') && !definition.page_component) return [{ code: 400, msg: `Page widget "${key}" is a component and needs a page_component` }, null];
  if(definition.hide_styles !== undefined && (!Array.isArray(definition.hide_styles) || definition.hide_styles.some(part => !(part in STYLE_PARTS)))){
    return [{ code: 400, msg: `Page widget "${key}" has an invalid hide_styles (use ${Object.keys(STYLE_PARTS).join(', ')})` }, null];
  }
  const attributes = [];
  for(const attribute of definition.attributes || []){
    if(!attribute || !NAME.test(attribute.name || '')) return [{ code: 400, msg: `Page widget "${key}" has an attribute without a valid name` }, null];
    const setting = Object.fromEntries(SETTING_FIELDS.filter(field => attribute[field] !== undefined).map(field => [field, attribute[field]]));
    if(Array.isArray(setting.options)) setting.options = setting.options.map(option => ({ value: String(option.value), label: String(option.label ?? option.value) }));
    attributes.push(setting);
  }
  const slots = (definition.slots || []).filter(slot => slot && NAME.test(slot.name || '')).map(slot => ({ name: slot.name, label: slot.label || slot.name }));
  const config = {
    owner,
    name: widgetName(owner, key),
    title: title.trim(),
    description: definition.description || '',
    icon: definition.icon || 'extension',
    iconSrc: definition.iconSrc,
    category: typeof definition.category === 'string' && definition.category.trim() ? definition.category.trim().toLowerCase() : 'content',
    categoryTitle: typeof definition.category_title === 'string' && definition.category_title.trim() ? definition.category_title.trim() : undefined,
    keywords: Array.isArray(definition.keywords) ? definition.keywords.map(String) : [],
    tag,
    page: definition.page_component,
    editor: definition.editor_component,
    editorTag: definition.editor_tag,
    settings: definition.settings_component,
    settingsTag: definition.settings_tag,
    section: definition.section === true,
    display: typeof definition.display === 'string' ? definition.display : undefined,
    hideStyles: definition.hide_styles,
    attributes,
    slots
  };
  return [null, Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined))];
};

const sorted = value => {
  if(Array.isArray(value)) return value.map(sorted);
  if(value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  return value;
};

/*
  The `kempo` block an extension declares on disk. When the row holds a different one of the same version, the disk one is
  written to the row, so an edit to kempo-config.json reaches the builder on the next load, with no restart and no version
  bump. A different version on disk is left to reconcileExtensions, which upgrades it.
*/
const declaredOf = async row => {
  try {
    const { pkg, kempo } = await readKempoConfig(join(process.cwd(), 'node_modules', row.name));
    if(pkg.version !== row.version || JSON.stringify(sorted(kempo)) === JSON.stringify(sorted(row.kempo))) return row.kempo;
    await db.update(extension).set({ kempo }).where(eq(extension.name, row.name));
    return kempo;
  } catch {
    return row.kempo;
  }
};

/* The enabled extensions' widgets, as kempo-ui widget definitions. */
export const loadExtensionWidgets = async () => {
  const rows = await db.select({ name: extension.name, version: extension.version, kempo: extension.kempo }).from(extension).where(eq(extension.enabled, true));
  const loaded = [];
  const names = new Set();
  for(const row of rows){
    for(const definition of (await declaredOf(row))?.page_widgets || []){
      const [error, widget] = normalizeExtensionWidget(row.name, definition);
      if(error){
        console.warn(`[${row.name}] page widget skipped: ${error.msg}`);
        continue;
      }
      if(BUILT_IN.has(widget.name) || names.has(widget.name)){
        console.warn(`[${row.name}] page widget "${definition.key}" skipped: another widget is already called ${widget.name}`);
        continue;
      }
      names.add(widget.name);
      loaded.push(widget);
    }
  }
  return loaded;
};

/* Puts exactly these extension widgets in kempo-ui's list, after the built-in ones. */
export const useExtensionWidgets = list => {
  for(let index = widgets.length - 1; index >= 0; index--){
    if(!BUILT_IN.has(widgets[index].name)) widgets.splice(index, 1);
  }
  for(const config of list) addWidget(config);
};

/*
  A module address as a page serves it. kempo-ui's own widgets name their modules by file (file:///.../kempo-ui/src/
  components/Accordion.js), which the site serves under /kempo-ui/ (from the package's built copy); an extension's are
  already addresses on the site.
*/
export const servedUrl = url => {
  const text = String(url);
  if(!text.startsWith('file:')) return text;
  const at = text.lastIndexOf('/src/');
  return at === -1 ? text : `/kempo-ui/${text.slice(at + '/src/'.length)}`;
};

/* The module addresses all the widgets of a registry need on a page: what a page file holds that the builder wrote. */
export const managedModules = registry => new Set([...registry.values()].flatMap(widget => (widget.page || []).map(servedUrl)));

/* The registry for this site: kempo-ui's widgets, kempo's server widgets and every enabled extension's. */
export default async () => {
  useExtensionWidgets(await loadExtensionWidgets());
  return registryOf(widgets);
};
