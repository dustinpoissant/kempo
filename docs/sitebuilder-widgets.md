# Building page builder widgets

This is everything an extension needs to add widgets to the page builder. You should not need kempo's source to build one. If something here is missing or wrong, that's a bug in this guide.

**Needs** kempo 4.10.0 or later (the page builder's extension API). Auto margins need kempo-css 2.3.0 or later. A widget can use any kempo-ui component.

## Contents

- [The short version](#the-short-version)
- [How a widget is stored](#how-a-widget-is-stored)
- [Declaring the widget](#declaring-the-widget)
- [Kinds of widget](#kinds-of-widget)
- [Attributes](#attributes)
- [Slots and nesting](#slots-and-nesting)
- [The page component](#the-page-component)
- [Editable text](#editable-text)
- [The editor](#the-editor)
- [Settings](#settings)
- [Groups, icons and search](#groups-icons-and-search)
- [Margins](#margins)
- [The round trip](#the-round-trip)
- [Testing](#testing)
- [Shipping checklist](#shipping-checklist)
- [A complete example](#a-complete-example)
- [Limits](#limits)
- [For kempo's maintainers](#for-kempos-maintainers)

## The short version

1. Declare the widget in `kempo-config.json` under `page_widgets`.
2. Write its page component: a web component that extends `Widget`, with a Lit property for each attribute.
3. Add a test that the widget's HTML reads back into the same widget (see [Testing](#testing)).

Everything else (an editor component, a settings panel, slots, groups) is optional.

## How a widget is stored

A page is saved as plain HTML. A widget is one element in it: its tag is the widget's tag, its attributes are its settings, its text is an editable text attribute, and its children are the widgets in its slots.

For example, a widget with key `callout`, tag `my-ext-callout` and the attribute `tone="warning"` is saved as:

```html
<my-ext-callout tone="warning">Stock is low.</my-ext-callout>
```

The widget's name on pages is `<extension>:<key>`, so `my-ext:callout` here. When the editor opens a page, kempo rebuilds the widget tree from this HTML. That is why the HTML must mean the same thing when it is read back (see [The round trip](#the-round-trip)).

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
| `editor_component`, `editor_tag` | no | A module, and the tag it defines, for the editor instead of the page component (see [The editor](#the-editor)). |
| `settings_component`, `settings_tag` | no | Both or neither. A module and the tag it defines, replacing the default settings panel (see [Settings](#settings)). |
| `attributes` | no | The widget's settings (see [Attributes](#attributes)). |
| `slots` | no | Places where other widgets go (see [Slots and nesting](#slots-and-nesting)). |
| `editable` | no | The name of a text attribute that is edited in place (see [Editable text](#editable-text)). |
| `only_in` | no | A list of widget keys this widget may only be placed inside, such as `["column"]`. |
| `category`, `category_title` | no | The group in the Add list (see [Groups, icons and search](#groups-icons-and-search)). |
| `icon`, `iconSrc` | no | An icon name, or the path of an icon file the extension ships. `iconSrc` wins if both are set. |
| `description`, `keywords` | no | Shown in the Add list. Keywords are matched by search as well as the title. |

A widget that breaks a rule is left out, and the server log says why, for example `[my-ext] page widget skipped: Page widget "callout" needs a tag`. The other widgets still load. The rules are: `key`, `title` and `tag` are present and valid; a component has a `page_component`; `settings_component` and `settings_tag` are both given or both missing; every path starts with `/`; and no two widgets share a component tag. Slots with an invalid name are dropped without a message.

Paths point at files the site serves. Files in the extension's `public/` folder are served under its public scope, so `/my-ext/components/Callout.js` is `public/components/Callout.js` in an extension whose public scope is `my-ext`.

## Kinds of widget

- **Component:** a custom element. It has a `tag` with a hyphen and a `page_component`. Most widgets are this kind.
- **Primitive:** a native element with no component, such as `"tag": "hr"`. Nothing is loaded on the page. Use it only for a plain HTML element with settings that map to attributes.
- **Server:** a widget that kempo's server fills in (Fragment, Location, Conditional, Repeat). Extensions can't declare these. They can offer fragments and locations that those widgets place.

## Attributes

Each attribute is one setting. It is stored on the element as an HTML attribute.

```json
{ "name": "tone", "type": "select", "label": "Tone", "hint": "How the box looks.", "default": "info", "options": [
  { "value": "info", "label": "Information" },
  { "value": "warning", "label": "Warning" }
] }
```

| Field | Meaning |
|---|---|
| `name` | The setting's name in the page builder. Required. |
| `attr` | The HTML attribute name, if different from `name`. |
| `type` | One of the types below. Defaults to `string`. |
| `label`, `hint` | The label of the setting, and a line of help shown under it. |
| `default` | The value a new widget starts with. |
| `options` | For `select`: a list of `{ value, label }`. |
| `min`, `max` | For `number`: the limits. |
| `format` | For `boolean`: `"text"` writes `attr="true"` or `attr="false"` instead of the attribute's presence. |
| `picker` | For `url`: `image`, `video` or `audio` adds a button that picks a file from the media library. |

| Type | Settings control | Stored as |
|---|---|---|
| `string` | Single-line text | The text. |
| `text` | Multi-line text | The text. |
| `number` | Number | A number, within `min` and `max`. |
| `boolean` | Switch | Present or absent. With `format: "text"`, `"true"` or `"false"`. |
| `url` | Text | An address that is safe to link to: `http`, `https`, `mailto`, `tel`, or a path on this site. |
| `image` | Image picker | A safe address. |
| `color` | Colour picker | `#rrggbb`, or `#rrggbbaa` with opacity. |
| `select` | Dropdown | One of the `options` values. |
| `id` | Text | Letters, digits, `-` and `_` only. |

Rules that apply to every attribute:

- **Only values that differ from the default are written.** A widget that keeps its default writes nothing for that attribute. So your component must handle a missing attribute by behaving as its default.
- **Values are cleaned on save and on read.** A value is coerced to its type, and an attribute the widget doesn't declare is dropped. Never rely on a value reaching the page unchanged.
- **Attributes are text on the page.** Your component receives strings, unless a Lit property converts them (see below).

### Lit property names

Lit reads an attribute into a property of the same name, but it lowercases camelCase names. A property `persistentId` reads the attribute `persistentid`. Either keep attribute names lowercase and single-word (`tone`, `message`), or give the property an explicit name with `attribute: 'persistent-id'` and declare the same name in `attr`/`name`.

## Slots and nesting

A slot is a place where other widgets go. Declare one in `slots`:

```json
"slots": [
  { "name": "default", "label": "Content" },
  { "name": "footer", "label": "Footer", "accepts": ["my-ext:button"] }
]
```

- `default` holds the widgets that have no `slot` attribute on the page. The widget's own children, when it has no declared slots, are not kept: a widget with no slots must not render any children.
- Any other slot holds the widgets whose page element has `slot="footer"`. The editor writes that attribute for you.
- `accepts` limits the widgets a slot takes, by key. Without it, a slot takes any widget.

Nesting is allowed up to 100 levels. Your component shows the children with `<slot>` (or `<slot name="footer">`) in its shadow DOM.

## The page component

The page component is the web component that the published page loads. Extend `Widget`, which is a kempo-ui `ShadowComponent` (so kempo-css is in its shadow DOM):

```js
import Widget from '/kempo/sitebuilder/components/Widget.js';
import { html, css } from '/kempo-ui/lit-all.min.js';

export default class Callout extends Widget {
  static properties = {
    message: { type: String, reflect: true },
    tone: { type: String, reflect: true }
  };

  static styles = css`
    :host { display: block; }
  `;

  render(){
    return html`<div class="p b r ${this.tone === 'warning' ? 'bc-warning tc-warning' : ''}">${this.message}<slot></slot></div>`;
  }
}

customElements.define('my-ext-callout', Callout);
```

Points to get right:

- **`:host { display: block; }`:** custom elements are inline by default, and vertical margins (and the widget's margin, see [Margins](#margins)) do nothing on an inline element.
- **Style with kempo-css classes,** not custom CSS. The `:host` rule is the one exception, to set the element's own display.
- **The page contains only the tag.** Anything else the widget shows must come from its own render. Don't add wrapper elements or scripts in the page HTML.
- **Declare a property for every attribute** that the render uses. Anything the widget doesn't read is still stored.
- **The script loads once per page.** kempo adds `<script type="module" src="...">` for each page component the page uses. Don't add your own.

## Editable text

Set `editable` to the name of a text attribute, and the widget's text is that attribute. The page then stores the text as the element's text:

```json
{ "key": "heading", "tag": "my-ext-heading", "editable": "text", "attributes": [
  { "name": "text", "type": "string", "label": "Text", "default": "Heading" }
] }
```

```html
<my-ext-heading>Welcome</my-ext-heading>
```

In the editor the text is typed in place. The element must hold text only, with no child elements, or the page can't be read back.

## The editor

By default the editor shows the page component itself, with the attributes you declared, and its settings are the default panel. That is right for most widgets and needs nothing more.

Write an **editor component** when the page component can't be used in the editor as it is. For example, the Form widget in kempo-forms shows a card with the form's title, not the live form, because a live form would load, validate and send in the middle of the editor.

```json
"editor_component": "/my-ext/components/CalloutEditor.js",
"editor_tag": "my-ext-callout-editor"
```

An editor component extends `WidgetEditor` (from `/kempo/sitebuilder/components/WidgetEditor.js`):

- `selected` is `true` while the widget is selected. The first click selects, and later clicks edit. Show editing controls only while `selected` is set.
- `emitChange({ attribute: value })` tells the editor the settings changed. The editor updates the widget and records an undo step.
- `tabIndex` is set for you, so the widget can be reached from the keyboard.

```js
import WidgetEditor from '/kempo/sitebuilder/components/WidgetEditor.js';
import { html } from '/kempo-ui/lit-all.min.js';

export default class CalloutEditor extends WidgetEditor {
  static properties = {
    ...WidgetEditor.properties,
    message: { type: String, reflect: true }
  };

  render(){
    return html`<div class="b r p">${this.message || 'Callout'}</div>`;
  }
}

customElements.define('my-ext-callout-editor', CalloutEditor);
```

The editor loads both the editor component and the page component into its preview, so use the same URL convention for both.

## Settings

By default the settings panel is built from `attributes`: a control for each, with its label and hint. That is usually enough.

For settings that need more (a list to add to, a preview, a button that opens a dialog), declare a settings component:

```json
"settings_component": "/my-ext/components/CalloutSettings.js",
"settings_tag": "my-ext-callout-settings"
```

It extends `WidgetSettings` (from `/kempo/sitebuilder/components/WidgetSettings.js`). The panel gives it these properties:

| Property | Meaning |
|---|---|
| `node` | The selected widget: `{ id, type, attrs, slots }`. |
| `registry` | The registry of all widgets. |
| `host` | The page editor. You don't call it directly; use the methods below. |
| `version` | A number that changes with every change to the page, so the panel redraws. |

| Method | Does |
|---|---|
| `set(name, value, coalesce = true)` | Changes one attribute. |
| `edit((node, nodes) => …)` | Changes the page any way you like, as one undo step. The function gets this widget's node and the whole tree. |
| `addChild(type, slot = 'default')` | Adds a widget inside this one, without changing the selection. |
| `select(id)` | Selects another widget, such as one of this one's children. |
| `renderFields(except = [])` | The default fields for the declared attributes, without the names in `except`. |
| `renderChoice(name, label, choices, { hint, swatch })` | An attribute as a row of buttons. Choices are `{ value, label, icon? }`. |
| `renderChildren(slot, { label, hint, addType, addLabel })` | The widgets in a slot, each with a button to select it, and a button to add one of `addType`. |

```js
import WidgetSettings from '/kempo/sitebuilder/components/WidgetSettings.js';
import { html } from '/kempo-ui/lit-all.min.js';

export default class CalloutSettings extends WidgetSettings {
  render(){
    return html`
      ${this.renderFields()}
      ${this.renderChoice('tone', 'Tone', [{ value: 'info', label: 'Information' }, { value: 'warning', label: 'Warning' }])}
    `;
  }
}

customElements.define('my-ext-callout-settings', CalloutSettings);
```

The settings module loads the first time a widget of that type is selected. Anything else in the panel is an ordinary component: it can import other elements, such as kempo-ui controls, and use the methods above.

Use kempo-ui components for controls (a `k-combobox`, a `k-toggle`, a `k-tags`) rather than writing your own.

## Groups, icons and search

- **`category`** puts the widget in a group in the Add list. Kempo's groups are `text`, `media`, `layout`, `content`, `interactive` and `server`. Any other name makes a new group after them. Widgets from several extensions that use the same name share the group.
- **`category_title`** sets the group's heading. Without it, the heading is the name with hyphens and underscores turned into spaces, so `my-shop` becomes "My shop".
- **`icon`** is the name of an icon that kempo-ui ships, such as `info`, `code`, `star` or `table`.
- **`iconSrc`** is the path of an icon file the site serves, such as `/my-ext/icons/callout.svg`. Use it for an icon of your own. It shows in the Add list, the widget tree and the settings panel.
- **`description`** is shown under the title in the Add list.
- **`keywords`** are matched by search, along with the title and description.

## Margins

Every extension widget gets the margin box in its settings. A margin is written as kempo-css classes on the widget's outer element, so the widget's element must be a block (see the `:host` rule above). An auto margin on the left and right centres a narrower widget, and it adds `d-b` to an element that isn't a block already.

Your component doesn't need to do anything for margins. Don't put margin classes on your own elements.

## The round trip

When the editor opens a page, kempo rebuilds the tree from the HTML, renders the tree back to HTML, and compares the two by meaning (whitespace, attribute order and quote style are ignored). If they differ, the page opens as code rather than in the builder. So your widget must satisfy these rules:

1. **The widget's HTML is its tag, the declared attributes that differ from their defaults, its editable text, and its slot children.** Nothing else.
2. **A widget with no slots has no children.** Children it doesn't declare are dropped, and the page then doesn't read back.
3. **An editable widget holds text only,** with no child elements.
4. **A child of a named slot has `slot="name"`.** A child of the default slot has no `slot` attribute.
5. **The widget's render depends only on its attributes, text and children.** It must not depend on the time, a random value, or the rest of the page. The same HTML must produce the same widget every time.
6. **The page's own script is the only script.** kempo adds the page component's script itself and ignores it when comparing.

If the extension is disabled, its widgets are kept as HTML and shown as an "unknown" widget. That also reads back exactly, so the page stays in the builder.

## Testing

Add a test that proves the widget is declared correctly and reads back as the same widget. Put it in your extension's `tests/` folder. This is the pattern kempo-forms uses; the test runs with `npm test`:

```js
import { readFile } from 'fs/promises';
import { normalizeExtensionWidget } from 'kempo/server/utils/sitebuilder/registry.js';
import { buildRegistry } from 'kempo/src/kempo/sitebuilder/registry.js';
import { renderLocation } from 'kempo/src/kempo/sitebuilder/render.js';
import { createNode } from 'kempo/src/kempo/sitebuilder/nodes.js';
import { sameMeaning } from 'kempo/server/utils/sitebuilder/normalize.js';
import rebuild from 'kempo/server/utils/sitebuilder/rebuild.js';

const config = JSON.parse(await readFile(new URL('../kempo-config.json', import.meta.url), 'utf8'));
const [error, callout] = normalizeExtensionWidget('my-ext', config.page_widgets[0]);
const registry = buildRegistry(error ? [] : [callout]);
const ctx = { registry };

export default {
  'the declaration is accepted': async ({ pass, fail }) => {
    if(error) return fail(error.msg);
    pass('');
  },

  'a callout reads back as the same widget': async ({ pass, fail }) => {
    const html = renderLocation([createNode('my-ext:callout', { tone: 'warning' }, { default: [createNode('markup', { html: '<p>Stock is low.</p>' })] })], ctx);
    const [readError, tree] = rebuild(html, registry);
    if(readError) return fail(readError.msg);
    if(tree[0].type !== 'my-ext:callout') return fail(JSON.stringify(tree));
    if(!sameMeaning(renderLocation(tree, ctx), html)) return fail(`${html} came back as ${renderLocation(tree, ctx)}`);
    pass('');
  }
};
```

The `kempo/...` imports are kempo's own files, which your extension has installed as a dependency. The round-trip test exercises every rule above, so write one for each kind of widget: one with its attributes at non-default values, one with children, and one with editable text.

Run it with the extension's test command. A widget that fails to round-trip shows up here, not on a page where it would open as code.

Finally, check the widget in the browser: add it from the Add list, change each setting, use the drag handle, save, reload, and look at the page on the site.

## Shipping checklist

- `kempo` peer dependency is `>=4.10.0` (or later).
- Every page component, editor component, settings component and icon file exists under the extension's `public/` folder, at the path declared.
- The round-trip tests pass.
- The widget has been added, edited, saved and reopened in the editor, and the page renders correctly on the site.
- README and CHANGELOG describe the widget.

## A complete example

The callout above, in full, is the declaration in `kempo-config.json`, `components/Callout.js` (the page component) and the round-trip test. Together they are a working widget:

- The declaration makes the widget available as `my-ext:callout` in the Add list, under Content.
- The page component draws a bordered box with a message and the content inside it. The `tone` setting changes its colour.
- The test checks that a callout with a warning tone and some content reads back as the same widget.

Add the settings component and editor component only when the default settings panel and the page component aren't enough.

## Limits

- **Extensions can't declare the server widgets** (Fragment, Location, Conditional, Repeat). They can offer fragments and locations for those to place.
- **Extensions can't use "virtual" attributes,** the settings that kempo's own widgets keep outside the HTML. A settings component is the way to build those settings.
- **Extension widgets can't opt out of margins.** Every extension widget gets the margin box.
- **The `alpha` option of a colour attribute isn't passed through** in a declaration yet, so a colour always has opacity. Say so if you need it turned off.

## For kempo's maintainers

These are the files that implement the widget API, for changing kempo itself.

| File | Role |
|---|---|
| `server/utils/sitebuilder/registry.js` | Reads and checks each extension's `page_widgets` (`normalizeExtensionWidget`). |
| `src/kempo/sitebuilder/registry.js` | Builds the registry the server and the editor share. |
| `src/kempo/sitebuilder/render.js` | Turns a widget tree into HTML, for the page and for the editor. |
| `server/utils/sitebuilder/rebuild.js` | Turns HTML back into a widget tree. Its generic reader handles extension widgets (`generic`). |
| `server/utils/sitebuilder/validateTree.js` | Checks and cleans every widget the editor saves. |
| `src/kempo/sitebuilder/attributes.js` | The attribute types and `registerAttributeType`. |
| `src/kempo/sitebuilder/components/` | `Widget`, `WidgetEditor`, `WidgetSettings`, `InlineToolbar`. |
| `src/kempo/sitebuilder/widgets.js` | Kempo's own widgets. The reference for anything the guide doesn't cover. |
| `src/admin/components/sitebuilder/` | The editor: the page, the tree, the settings panel, and the preview frame (`frame.js`). |
| `tests/sitebuilder-widgets.node-test.js` | Kempo's tests for the widget API. |
