# Building page builder widgets

This is everything an extension needs to add widgets to the page builder. The builder is [kempo-ui's `<k-page-builder>`](https://dustinpoissant.github.io/kempo-ui/components/page-builder.html), and an extension's widget is a kempo-ui widget definition, written as JSON in `kempo-config.json`. If something here is missing or wrong, that's a bug in this guide.

**Needs** a kempo that has kempo-ui's page builder (see the changelog) and kempo-ui 1.3.1 or later. A widget can use any kempo-ui component.

## Contents

- [The short version](#the-short-version)
- [How a widget is stored](#how-a-widget-is-stored)
- [Declaring the widget](#declaring-the-widget)
- [Settings](#settings)
- [Slots and nesting](#slots-and-nesting)
- [The page component](#the-page-component)
- [The editor component](#the-editor-component)
- [The settings component](#the-settings-component)
- [Groups, icons and search](#groups-icons-and-search)
- [Testing](#testing)
- [Shipping checklist](#shipping-checklist)
- [Limits](#limits)
- [For kempo's maintainers](#for-kempos-maintainers)

## The short version

1. Declare the widget in `kempo-config.json` under `page_widgets`.
2. Write its page component: a web component that extends kempo-ui's `ShadowComponent`, with a Lit property for each setting.
3. Add a test that the widget is declared correctly and is written as you expect (see [Testing](#testing)).

Everything else (an editor component, a settings panel, slots, groups) is optional.

## How a widget is stored

A page's widgets are a tree (JSON) that the builder edits and the server stores. When the page is saved, each widget writes its HTML into the page file: one element, whose tag is the widget's tag, whose attributes are its settings and whose children are the widgets in its slots.

A widget with key `callout`, tag `my-ext-callout` and the setting `tone` set to `warning` is written as:

```html
<my-ext-callout tone="warning"><p>Stock is low.</p></my-ext-callout>
```

The widget's name in the tree is `<extension>-<key>` in lowercase, so `my-ext-callout` here. The builder never reads the HTML back into the tree: the tree is the truth, so a widget has **no round-trip rule** to satisfy. It only has to draw the same on the page and in the editor. The script of each page component the page uses is added once at the end of the content (`<script type="module" src="…">`); do not add your own.

## Declaring the widget

Widgets are declared in `kempo-config.json` in an array called `page_widgets`:

```json
{
  "page_widgets": [
    {
      "key": "callout",
      "title": "Callout",
      "description": "A boxed message that draws attention.",
      "icon": "info",
      "category": "content",
      "keywords": ["notice", "alert", "warning"],
      "tag": "my-ext-callout",
      "page_component": "/my-ext/components/Callout.js",
      "attributes": [
        { "name": "tone", "type": "select", "label": "Tone", "default": "info", "options": [
          { "value": "info", "label": "Information" },
          { "value": "warning", "label": "Warning" }
        ] }
      ],
      "slots": [{ "name": "default", "label": "Content" }]
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `key` | yes | The widget's name within the extension. Letters, digits, `-` and `_`, starting with a letter. |
| `title` | yes | The name shown in the Add list and the widget tree. |
| `tag` | yes | The element name on the page. Lowercase letters, digits and hyphens, starting with a letter. A component's tag must contain a hyphen. |
| `page_component` | for components | The path of the module that defines the tag on the published page. It starts with `/`. |
| `editor_component`, `editor_tag` | no | Both or neither. A module, and the tag it defines, drawn in the editor instead of the page element (see [The editor component](#the-editor-component)). |
| `settings_component`, `settings_tag` | no | Both or neither. A module, and the tag it defines, replacing the default settings panel (see [The settings component](#the-settings-component)). |
| `attributes` | no | The widget's settings (see [Settings](#settings)). |
| `slots` | no | Places where other widgets go (see [Slots and nesting](#slots-and-nesting)). |
| `section` | no | `true` for a widget that is one part of another (a column of a row, a tab). Sections are left out of the Add list. |
| `display` | no | The display class the widget's element gets. Left out, it is `d-b` (block). `""` for a widget that sets its own display in its component's styles, such as one whose `inline` setting changes it. |
| `hide_styles` | no | A list of the parts of the Styles tab the widget does not need, because it has its own setting for them: `box` (margin, padding, corners, borders), `background`, `textColour`, `align`, `id`, `classes`. A button whose colour is its `variant` setting hides `background` and `textColour`, so there is one way to set it. A hidden part is left out of the tab, and what was stored for it is not written on the page. An unknown part skips the widget. |
| `category`, `category_title` | no | The group in the Add list (see [Groups, icons and search](#groups-icons-and-search)). |
| `icon`, `iconSrc` | no | An icon name, or the path of an icon file the extension ships. |
| `description`, `keywords` | no | Shown in the Add list. Keywords are matched by search as well as the title. |

A widget that breaks a rule is left out, and the server log says why, for example `[my-ext] page widget skipped: Page widget "callout" needs a tag`. The other widgets still load. The rules are: `key`, `title` and `tag` are present and valid; a component has a `page_component`; the editor and settings fields come in pairs; every path starts with `/`; and no widget has the name of another. Slots with an invalid name are dropped without a message.

Paths point at files the site serves. Files in the extension's `public/` folder are served under its public scope, so `/my-ext/components/Callout.js` is `public/components/Callout.js` in an extension whose public scope is `my-ext`. Admin components are under `/admin/extension/<extension>/` (its `admin/` folder).

## Settings

Each attribute is one setting, written on the element as an HTML attribute. A setting that is at its default is not written, so your component must treat a missing attribute as its default.

```json
{ "name": "tone", "type": "select", "label": "Tone", "hint": "How the box looks.", "default": "info", "options": [
  { "value": "info", "label": "Information" },
  { "value": "warning", "label": "Warning" }
] }
```

| Field | Meaning |
|---|---|
| `name` | The setting's name. Required. |
| `attr` | The HTML attribute name, if different from `name`. |
| `type` | One of the types below. Defaults to `string`. |
| `label`, `hint` | The label of the setting, and a line of help shown under it. |
| `default` | The value a new widget starts with. |
| `options` | For `select`: a list of `{ value, label }`. |
| `min`, `max` | For `number`: the limits. |
| `format` | For `boolean`: `"text"` writes `attr="true"` or `attr="false"` instead of the attribute's presence. |
| `virtual` | `true` for a setting that is kept in the tree but not written as an attribute (your page component never sees it). |
| `when` | Shows the setting only while other settings have values: `{ "kind": "link" }`. |
| `beside` | The name of a number setting to draw this one beside, with no label of its own (a unit select). |

| Type | Settings control | Kept as |
|---|---|---|
| `string` | Single-line text | The text. |
| `text` | Multi-line text | The text. |
| `number` | Number | A number, within `min` and `max`. |
| `boolean` | Switch | Present or absent. With `format: "text"`, `"true"` or `"false"`. |
| `url` | Text | An address that is safe to link to: `http`, `https`, `mailto`, `tel`, or a path on this site. |
| `image`, `video`, `audio` | Text, and a button that opens the media library | A safe address. |
| `color` | Colour picker | `#rgb`, `#rrggbb` or `#rrggbbaa`. |
| `select` | Dropdown | One of the `options` values. |
| `id` | Text | Letters, digits, `-` and `_` only. |
| `icon` | The site's icon picker | A kempo-ui icon name (`add`), or `src:` and the path of an SVG file on this site (`src:/commerce/icons/receipt.svg`). Empty for no icon. |
| `json` | None (use a settings component) | Plain data. |

Every value is **cleaned by the server on save**: coerced to its type, limited to its options, addresses checked, and a setting the widget does not declare dropped. Never rely on a value reaching the page unchanged. An icon setting is written on the element as it is kept (`icon="src:/commerce/icons/receipt.svg"`), so a component that draws it with `<k-icon>` handles both forms: `src:` and the path is `<k-icon src="…">`, anything else is `<k-icon name="…">`.

Every widget also has a **Styles** tab, which kempo adds: margin, padding, background, text colour, alignment, corners, borders, an id and extra classes, written as kempo-css classes on the widget's first element. Your element has to be a block for them to show (see `:host` below).

### Lit property names

Lit reads an attribute into a property of the same name, but it lowercases camelCase names. A property `persistentId` reads the attribute `persistentid`. Either keep names lowercase and single-word (`tone`), or give the property an explicit attribute name: `persistentId: { type: String, attribute: 'persistent-id' }`, and declare the setting as `persistent-id`.

## Slots and nesting

A slot is a place where other widgets go. Declare one in `slots`:

```json
"slots": [
  { "name": "default", "label": "Content" },
  { "name": "footer", "label": "Footer" }
]
```

- `default` holds the widgets that have no `slot` attribute on the page. A widget with no slots holds no children: anything placed in it is not kept.
- Any other slot holds the widgets whose page element has `slot="footer"`. The builder writes that attribute for you. In the builder each of these slots is drawn as a place to drop into, even while it is empty: a `<div slot="footer">` that holds the widgets in it (the page has no such `div`), so your editor component needs `<slot name="footer">` to show it. Name the slots so the first one is where a widget added with the toolbar should land.

**Anything can go in anything.** Every widget that has a slot takes any widget in it, and any widget can be placed at the top of a page. There are no placement rules to declare. A widget that needs a particular ancestor finds it where it is drawn with `closest()`:

```js
const parentProduct = this.closest('my-ext-parent');
if(!parentProduct) return html`<p>Place this in a parent.</p>`;
```

Nesting is allowed up to 100 levels. Your component shows the children with `<slot>` (or `<slot name="footer">`) in its shadow DOM.

## The page component

The page component is the web component the published page loads. Extend kempo-ui's `ShadowComponent` (so kempo-css is in its shadow DOM):

```js
import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css } from '/kempo-ui/lit-all.min.js';

export default class Callout extends ShadowComponent {
  static properties = {
    tone: { type: String, reflect: true }
  };

  static styles = css`
    :host { display: block; }
  `;

  render(){
    return html`<div class="p b r ${this.tone === 'warning' ? 'bc-warning tc-warning' : ''}"><slot></slot></div>`;
  }
}

customElements.define('my-ext-callout', Callout);
```

Points to get right:

- **`:host { display: block; }`:** custom elements are inline by default, and margins, padding and borders do nothing useful on an inline element.
- **Style with kempo-css classes,** not custom CSS. The `:host` rule is the one exception.
- **The page contains only the tag.** Anything else the widget shows must come from its own render.
- **Declare a property for every setting** that the render uses.
- **The same module is loaded in the builder,** so the widget is drawn live while it is edited. If it must not do what it does on the page there (load data, send a form), write an [editor component](#the-editor-component).

## The editor component

By default the builder draws the page component itself, with the settings you declared. That is right for most widgets.

Write an **editor component** when the page component can't be used in the builder as it is. For example, the Form widget in kempo-forms shows a card with the form's title, not the live form, because a live form would load, validate and send in the middle of the editor.

```json
"editor_component": "/admin/extension/my-ext/components/pagebuilder/CalloutEditor.js",
"editor_tag": "my-ext-callout-editor"
```

An editor component extends kempo-ui's `WidgetEditor` (`/kempo-ui/components/pagebuilder/WidgetEditor.js`), and is drawn with the widget's settings as attributes:

- `selected` is `true` while the widget is the only one selected, so editing controls show only then. The first click selects, and later clicks edit.
- `emitChange({ setting: value })` tells the builder the widget changed, as one undo step.

```js
import WidgetEditor from '/kempo-ui/components/pagebuilder/WidgetEditor.js';
import { html } from '/kempo-ui/lit-all.min.js';

export default class CalloutEditor extends WidgetEditor {
  static properties = {
    ...WidgetEditor.properties,
    tone: { type: String, reflect: true }
  };

  render(){
    return html`<div class="b r p">Callout (${this.tone || 'info'})</div>`;
  }
}

customElements.define('my-ext-callout-editor', CalloutEditor);
```

## The settings component

By default the settings panel is built from `attributes`: a control for each, with its label and hint. That is usually enough. For settings that need more (a list to choose from, a preview, a button that opens a dialog), declare a settings component:

```json
"settings_component": "/admin/extension/my-ext/components/pagebuilder/CalloutSettings.js",
"settings_tag": "my-ext-callout-settings"
```

It extends kempo-ui's `WidgetSettings` (`/kempo-ui/components/pagebuilder/WidgetSettings.js`). The panel gives it `node` (the selected widget: `{ id, type, attrs, slots }`), `widget` (its definition), `host` (the builder), `registry` and `version` (a number that changes with every change, so the panel redraws).

| Method | Does |
|---|---|
| `set(name, value, coalesce = true)` | Changes one setting, as one undo step (typing in a row is one step with `coalesce`). |
| `edit((node, nodes) => …, coalesce = false)` | Changes the page any way you like, as one undo step. The function gets this widget's node and the whole tree, and returns `true` to keep the change. |
| `addChild(type, slot = 'default')` | Adds a widget inside this one, without changing the selection. |
| `renderFields(except = [])` | The default fields for the declared settings, without the names in `except`. |

```js
import WidgetSettings from '/kempo-ui/components/pagebuilder/WidgetSettings.js';
import { html } from '/kempo-ui/lit-all.min.js';

export default class CalloutSettings extends WidgetSettings {
  render(){
    return html`
      <div class="mb">
        <label class="d-b mbq" for="tone">Tone<small class="d-b tc-muted">How the box looks.</small></label>
        <select id="tone" class="full" @change="${event => this.set('tone', event.target.value, false)}">
          <option value="info" ?selected="${this.node.attrs?.tone !== 'warning'}">Information</option>
          <option value="warning" ?selected="${this.node.attrs?.tone === 'warning'}">Warning</option>
        </select>
      </div>
      ${this.renderFields(['tone'])}
    `;
  }
}

customElements.define('my-ext-callout-settings', CalloutSettings);
```

The module loads the first time a widget of that type is selected. Use kempo-ui components for controls (a `k-combobox`, a `k-toggle`) rather than writing your own.

## Groups, icons and search

- **`category`** puts the widget in a group in the Add list. kempo-ui's groups are `content`, `media`, `layout` and `interactive`, and kempo adds `server`. Any other name makes a new group after them. Widgets from several extensions that use the same name share the group.
- **`category_title`** sets the group's heading. Without it, the heading comes from the name.
- **`icon`** is the name of an icon that kempo-ui ships, such as `info`, `code`, `star` or `table`.
- **`iconSrc`** is the path of an icon file the site serves, such as `/my-ext/icons/callout.svg`. Use it for an icon of your own.
- **`description`** is shown under the title in the Add list; **`keywords`** are matched by search, along with the title and description.

## Testing

Add a test that proves the widget is declared correctly and is written as you expect. Put it in your extension's `tests/` folder. Kempo's registry code cleans the declaration (so one it would refuse fails here, not in somebody's editor) and kempo-ui's renderer, which has no DOM, writes the page. Load kempo-ui from kempo's own copy, so it is the one kempo's registry adds the widgets to:

```js
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async file => import(pathToFileURL(file).href);
const kempo = relative => load(path.join(root, 'node_modules', 'kempo', relative));
const ui = relative => load(path.join(root, 'node_modules', 'kempo', 'node_modules', 'kempo-ui', 'src', relative));

const config = JSON.parse(await readFile(path.join(root, 'kempo-config.json'), 'utf8'));
const { normalizeExtensionWidget } = await kempo('server/utils/sitebuilder/registry.js');
const { widgets, addWidget, registryOf } = await ui('utils/pageWidgets.js');
const { renderPage, collectModules } = await ui('utils/renderPage.js');
const { createNode } = await ui('utils/pageTree.js');

const [error, callout] = normalizeExtensionWidget('my-ext', config.page_widgets[0]);
if(!error) addWidget(callout);
const registry = registryOf(widgets);

export default {
  'the declaration is accepted': async ({ pass, fail }) => {
    if(error) return fail(error.msg);
    pass('');
  },

  'a callout is written with its tone, and loads its component': async ({ pass, fail }) => {
    const nodes = [createNode('my-ext-callout', { tone: 'warning' })];
    const html = renderPage(nodes, registry);
    if(!html.startsWith('<my-ext-callout') || !html.includes('tone="warning"')) return fail(html);
    if(!collectModules(nodes, registry).includes('/my-ext/components/Callout.js')) return fail('the component is not loaded');
    pass('');
  }
};
```

To test what the server keeps of a page (the cleaning by type), run the nodes through `kempo/server/utils/sitebuilder/validateTree.js` (its default export, `(nodes, registry) → [error, nodes]`) first. `renderPage(nodes, registry, { editor: true })` is what the builder draws.

Finally, check the widget in the browser: add it from the Add list, change each setting, save, reload, and look at the page on the site.

## Shipping checklist

- The `kempo` peer dependency is the first kempo release that has kempo-ui's page builder, and `kempo-ui` is `>=1.3.1`.
- Every page component, editor component, settings component and icon file exists at the path declared.
- The tests pass.
- The widget has been added, edited, saved and reopened in the builder, and the page renders correctly on the site.
- README and CHANGELOG describe the widget.

## Limits

- **Extensions can't declare the server widgets** (Fragment, Location, Conditional, Repeat). They can offer fragments and locations for those to place.
- **A declaration can't set** a widget's `content` (the text a widget holds as its children) or `render`. Use a component that renders its own content and `<slot>`s.
- **Every widget gets the Styles tab.** A widget can hide parts of it (`hide_styles`) but can't opt out of it.
- **The `icon` setting's value changed** when kempo moved to kempo-ui's builder: a path alone (`/commerce/icons/receipt.svg`) is no longer a value; it is `src:/commerce/icons/receipt.svg`. A component that gets either (such as one that reads an old page) should handle both.

## For kempo's maintainers

| File | Role |
|---|---|
| `server/utils/sitebuilder/registry.js` | Reads and checks each extension's `page_widgets` (`normalizeExtensionWidget`) into kempo-ui widget definitions, and keeps kempo-ui's widget list up to date with the enabled extensions. |
| `src/kempo/pagebuilder/serverWidgets.js` | The server widgets. Imports nothing: the server and the admin register the same list. |
| `src/kempo/pagebuilder/rawHtml.js` | The change to kempo-ui's HTML widget: written with no element around it. |
| `server/utils/sitebuilder/validateTree.js` | Checks and cleans every tree the builder saves. |
| `server/utils/sitebuilder/pageCore.js` | Reads and writes page files, renders a tree to HTML and adds the module scripts, takes a file as it is (`adoptFile`). |
| `src/admin/components/pagebuilder/PageBuilderEditor.js` | The admin's `<k-page-builder>`: registers the widgets and pickers, switches content areas, the page menu, templates. |
| `tests/sitebuilder-pages.node-test.js` | Kempo's tests for opening, saving, conflicts, templates and the extension widgets. |
