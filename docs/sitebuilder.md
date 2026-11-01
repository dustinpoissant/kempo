# The Page Builder

Kempo's page editor is a block-based page builder, in the way WordPress blocks work: a page is built from **widgets** that are added, configured and nested, and the page is saved as plain HTML. It replaces the visual editor that pages used to have. The admin's side navigation is the only thing left around it: the builder takes the rest of the screen.

Open **Content > Pages**, pick a page, and the builder opens.

## The editor

One control bar runs across the top. From the left:

- the **widget tree** button, which opens the tree of the page's widgets on the left;
- back to the pages, and view the page;
- the page's name;
- **Add** (opens a searchable list of widgets), delete, move up, move down, move into the widget before, move out of the parent;
- duplicate, **save as template** and **insert template**;
- phone, tablet and desktop previews;
- a switcher for the page's content areas, when its template has more than one;
- undo, redo and save;
- a **more** menu: page settings (which selects nothing, so the right panel shows them), the head code, editor settings, keyboard shortcuts (a list of everything below), copy, move, replace another page, reset and delete;
- the **widget settings** button, which shows or hides the right panel: the settings of the selected widget, or, when nothing is selected, the page's own settings (name, title, description and template, with who made it and when). They apply as you type and are saved with the page.

The page itself is in the middle, in an iframe, so your site's theme shows rather than the admin's.

### Selecting and editing

The first click on the page selects the outermost widget under the pointer (a Row, say): it is highlighted in the tree, its settings load on the right, and the control bar acts on it. Each click inside the selected widget selects the next widget down towards the one clicked (the Column, then the Text in it), however deeply they are nested. Once the widget that was clicked is selected, further clicks are normal editing: they place the cursor in its text. Shift or Ctrl clicks select several widgets that share a parent. The tree and the page are separate places to drag from: select a widget and drag the handle that appears over it on the page, or drag a row in the tree. While a widget is dragged, every place it can go shows as a box and the one under the pointer fills in (letting go anywhere else cancels the drop): a box at the very top of the page and between and inside the widgets, except where dropping would not move it. Selection outlines, the drag handle and these boxes are green, and orange for a widget that can only go in one kind of parent (a Column in a Row, a section in an accordion), which therefore has no box on the page itself.

### Keyboard shortcuts

On a Mac, Ctrl means Cmd.

| Keys | Does |
|---|---|
| Ctrl+K | Open the Add a widget list with the search focused; Enter adds the first widget it finds (works while typing in text too) |
| Ctrl+S | Save |
| Ctrl+D | Duplicate the selected widgets (the editor cancels the browser's bookmark shortcut while it has focus) |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z, Ctrl+Shift+Y, Ctrl+Y | Redo |
| Delete | Remove the selected widgets |
| Escape | Stop typing and keep the widget selected, then select its parent, and at the top of the page select nothing (clicking an empty part of the tree or the page does the same) |
| Alt+Shift+Up / Down | Move the selection up or down |
| Alt+Shift+Left / Right | Move the selection out of its parent / into the widget before it |

Inside text the browser's own shortcuts work (Ctrl+B and the rest), and Ctrl+Z and Delete stay the text's own, so one key never does two things.

### Undo, saving and leaving

Undo and redo are kept in the browser, up to 50 steps, and a reload clears them. Saving publishes the page at once: pages are served from their files, so there are no drafts. To work on a draft, **copy** the page, edit the copy (nothing links to it, so only you can find it by its address) and use **Replace another page** on the copy to publish it over the original. The editor asks before a reload or a close while there are unsaved changes.

### Templates

**Save as template** saves the selected widgets (with everything inside them) under a name; **insert template** places a copy of one. A template is a pattern: changing it later does not change the pages that used it. Content that should be changed in one place and shared by many pages is a **Fragment** (see Server widgets).

### Editor settings

Kept in your browser. **Confirm deletion** (off by default) asks before the Delete key or the delete button removes a widget.

## Widgets

### The ones kempo provides

| Group | Widgets |
|---|---|
| Text | **Text** (paragraphs, headings, lists, quotes, code and inline formatting, edited with the visual editor without its code view) |
| Media | Image, Video (a URL: a file from the media library, or a YouTube or Vimeo address), Audio (a URL or a file from the media library), File (a download link), Photo viewer (one picture, or a gallery: several chosen at once from the media library), Hero (a large background image with a slot), Embed (YouTube, Vimeo or Spotify) |
| Layout | Group, Row and Column (add as many columns to a row as you like; a column's width is set in its settings, out of 12, and columns without one share what is left; columns stack on a phone unless told not to), Spacer, Divider |
| Content | Button (a **Link** with a URL, or a real **Button** with an ID that a script on the page can find with `document.getElementById`), Table, HTML (written by hand, edited in a large code dialog), Script (a script file with its type, defer, async, cross-origin and integrity settings, or JavaScript written in a large code dialog; put these in the page's **Scripts** content area), Social icons |
| Interactive | Accordion (with sections), Tabs (with tabs), Card, Content slider, Show more, Icon |
| Server | Fragment, Location, Conditional, Repeat |

#### Settings that are more than attributes

Some widgets have their own settings panel (see Settings components below), so what a person sets is what they mean, not an HTML attribute:

- **Video:** everything kempo-ui's `k-video` supports, as settings: the **controls** (none, minimal, normal or everything), **play automatically** (muted, as browsers require), **loop**, **muted**, **remember where the viewer stopped**, how much **loads** first, the **skip** distance and how soon the controls **hide**. The size is a **maximum width** (empty fills the space) and a **position**, an **aspect ratio** (16:9, 21:9, 4:3, square or portrait) and, for a video file, whether it is **fit** whole or filled and cropped. A YouTube or Vimeo address gets the options the provider has (autoplay, muted, loop, no controls) and the aspect ratio; the rest are for video files.
- **Image:** **Full width** (the picture fills its place and keeps its aspect ratio, in place of a width in pixels), an **aspect ratio** (square, 4:3, 3:2, 16:9, 21:9 or portrait), how the picture **fits** the aspect ratio (fill and crop, or show all) and its **corners** (square, rounded or a circle). The page gets the kempo-css classes `full`, `r` or `round` and a `style` with `aspect-ratio` and `object-fit`; the person sees none of it.
- **Button:** the colour is chosen from swatches, and a link can **open in a new tab** (`target="_blank" rel="noopener"`).
- **Row:** a **layout** picked from common ones (1 to 4 equal columns, 1/3 + 2/3, 2/3 + 1/3, 1/4 + 3/4, 3/4 + 1/4) adds or removes columns to match and moves the content of a removed column into the last one; the columns are listed, each a click from its settings, and a button adds one.
- **Column:** its width as a fraction (fill, 1/4, 1/3, 1/2, 2/3, 3/4 or full), and an exact width out of 12 for anything else.
- **Accordion, Tabs and Content slider:** their sections, tabs or slides are listed, each a click from its settings, with **Add section**, **Add tab** and **Add slide** buttons.
- **Photo viewer:** pictures are added several at a time from the media library (or by URL), each with its alternative text and buttons to move or remove it, and **Photos per row** (2, 3, 4 or 6) once there are two or more. One picture is a single `<k-photo-viewer>`; more are a `row` of them, which kempo-ui pages through with the arrow buttons.
- **Hero:** the height as a choice and the overlay darkness as a slider.

There is no raw HTML widget. If you need markup or JavaScript no widget offers, make a widget for it (see below) or edit the page as code.

### Server widgets

A server widget writes one of the server's own template tags, which the server resolves on every request, so the page is still a plain file.

- **Fragment** places a fragment (`<fragment name="nav" />`): a disclaimer or notice used on many pages and edited in one place.
- **Location** is a place other extensions fill (`<location name="…" />`).
- **Conditional** (`<if condition="name">`) shows its content only when a value is set; put `!` in front to invert it.
- **Repeat** (`<foreach in="list" as="item">`) repeats its content for each item of a list.

Conditional and Repeat can use the values the server has for a page: the attributes on its `<page>` tag, the built-ins (`year`, `date`, `datetime`, `timestamp`) and the site's globals. In the editor a server widget is a labelled placeholder, because nothing resolves it there. `{{ }}` can be typed in any text and is kept as typed; the tags themselves only come from server widgets.

## How a page is stored

The page file is what is served, and it is plain HTML: no render happens per request. The builder keeps the widget tree (JSON) in its own database table (`sitebuilderPage`), keyed by the page's file path, with the hash of the file it last wrote.

When a page is opened, the file's hash is compared with the stored one.

- **They match:** the page opens from the tree.
- **There is no row** (the page was copied or deployed without it): a tree is rebuilt from the HTML and stored, if the rebuild is exact.
- **They differ** (the file was changed outside the builder): the tree stored and the file are compared by meaning (whitespace, attribute order and quote style do not matter). If they say the same thing, nothing happens. If they differ, someone who can edit the page gets a dialog with a preview of each version and chooses which to keep. Choosing saves both sides: the file is rebuilt into a tree, or the tree is rendered over the file.

A page the builder cannot rebuild **exactly** (a script, an iframe, a tag nothing knows, or text the sanitizer would change) is edited as code instead. Going from code back to the builder replaces the page's content: you choose to start over with an empty page, or to start from the last page the builder had.

Saving checks that the file is still the one the editor opened, so two people cannot silently overwrite each other.

Copying, moving, disabling, enabling and deleting a page take the builder's row with them. **Replace another page** moves a page over another page after a confirmation.

## Writing widgets for your extension

An extension declares the widgets a page can hold in `kempo-config.json`:

```json
{
  "page_widgets": [
    {
      "key": "banner",
      "title": "Banner",
      "description": "A coloured notice with a message.",
      "icon": "campaign",
      "category": "content",
      "keywords": ["notice", "alert"],
      "tag": "my-banner",
      "page_component": "/my-ext/components/Banner.js",
      "attributes": [
        { "name": "message", "type": "string", "label": "Message", "default": "Hello" },
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

A widget is one of three types, by what its page side is:

- a **primitive** is a native element (`"tag": "hr"`, no `page_component`): nothing is loaded on the page;
- a **component widget** is a web component: `tag` plus `page_component`, the path of the file that defines it. The path can point anywhere, including a kempo-ui component (`/kempo-ui/components/Card.js`); nothing is wrapped or re-exported;
- a **server widget** is kempo's own and is not declared by extensions. An extension offers fragments and locations, which the Fragment and Location widgets place.

The `tag` is always declared, because pages are read back into widgets by their tags. Whether kempo or an extension ships a widget is not a type.

| Field | |
|---|---|
| `key`, `title` | Required. The widget is known on pages as `extension-name:key`. |
| `tag` | Required. A custom element name (it has a hyphen) for a component widget. |
| `page_component` | The page's module. Required for a component widget. |
| `editor_component` | Optional. A module for the editor. Without it, the editor shows the real page element and edits the declared attributes. |
| `editor_tag` | The tag `editor_component` defines, if it is not `tag`. |
| `settings_component`, `settings_tag` | Optional, together. A module and the tag it defines for the widget's own settings, shown in the right panel instead of the fields built from `attributes` (see below). |
| `attributes` | The widget's settings, set as plain attributes on the tag. Every attribute needs a sensible default, so a new widget works at once. |
| `slots` | `{ "name": "default", "label": "…", "accepts": ["key"] }`. Other widgets can be placed in a slot, so widgets nest (up to 100 levels). Children of a slot other than `default` get `slot="name"` on their tag. |
| `editable` | The name of an attribute that is the element's own text, edited in place. |
| `only_in` | A list of widget keys this widget may only be placed inside. |
| `icon`, `iconSrc`, `description`, `keywords` | How the widget shows in the Add list, the widget tree and its settings. `icon` is a name from the icon set; `iconSrc` is the path of an icon file the extension ships, and wins when both are given. |
| `category`, `category_title` | The group the widget is listed under in the Add list. Use one of kempo's (`text`, `media`, `layout`, `content`, `interactive`, `server`) or any other name to make a new group, which is listed after them. Widgets from several extensions that use the same name share the group. A new group is titled from its name (`my-shop` is "My shop"), or from `category_title` when a widget gives one. |

### Attribute types

`string`, `text` (several lines), `number` (`min`, `max`), `boolean` (`"format": "text"` writes `attr="true"` and `attr="false"` for components that read them so), `url`, `color` (a color picker and an opacity; kept as `#rrggbb`, or `#rrggbbaa` when see-through; `"alpha": false` leaves out the opacity), `image` (uses the media library when kempo-media or kempo-files is installed, and a plain field otherwise) and `select` (`options`). A `url` attribute can add `"picker": "video"` (or `"audio"` or `"image"`) to offer a **Choose from the media library** button beside the field, which opens the library on that kind of file when kempo-media or kempo-files is installed. Only what differs from a default is written to the page. Extensions can add types with `registerAttributeType` from `/kempo/sitebuilder/attributes.js`.

### Settings components

A widget is customised three ways: the component that draws it on the page, the editor component, and its settings. By default the settings are the fields built from the declared `attributes`. A widget that needs more (the Content slider's **Add slide** button, a list to reorder, a preview) declares `settings_component` and `settings_tag`, and the right panel shows that component instead. Extend `WidgetSettings` (`/kempo/sitebuilder/components/WidgetSettings.js`), a kempo-ui `ShadowComponent`:

```js
import WidgetSettings from '/kempo/sitebuilder/components/WidgetSettings.js';
import { html } from '/kempo-ui/lit-all.min.js';

export default class ProductGridSettings extends WidgetSettings {
  render(){
    return html`
      ${this.renderFields()}
      <button @click="${() => this.addChild('my-extension:product')}">Add a product</button>
    `;
  }
}

customElements.define('my-extension-product-grid-settings', ProductGridSettings);
```

The panel gives it `node` (the selected widget, `{ id, type, attrs, slots }`), `registry`, `host` (the page editor) and `version`, a number that changes with every change to the page, so it redraws when the widget changes. `renderFields()` draws the declared attributes as the default panel does, so a settings component adds to them. `set(name, value)` changes an attribute, `edit((node, nodes) => …)` changes the page any way it likes as one undo step, `addChild(type, slot = 'default')` adds a widget inside this one without changing the selection and `select(id)` selects another widget. `renderChoice(name, label, choices)` draws an attribute as a row of buttons (or colour swatches) and `renderChildren(slot, options)` lists what is in a slot with a button that adds one. Anything else is a normal component: it can import other elements and call `host`'s methods. The module is loaded the first time a widget of that type is selected.

### The components

`Widget` (`/kempo/sitebuilder/components/Widget.js`) is the base class for the page side; it is a kempo-ui `ShadowComponent`, so kempo-css is already in its shadow DOM. `WidgetEditor` (`/kempo/sitebuilder/components/WidgetEditor.js`) extends it for the editor side: it is focusable, has `selected` set while the widget is selected (the first click selects and later clicks edit, so open your editing controls only then), and has `emitChange({ attribute: value })` to tell the editor settings changed.

```js
import Widget from '/kempo/sitebuilder/components/Widget.js';
import { html } from '/kempo-ui/lit-all.min.js';

export default class Banner extends Widget {
  static properties = { message: { type: String, reflect: true } };
  render(){ return html`<div class="p bg-primary">${this.message}<slot></slot></div>`; }
}
customElements.define('my-banner', Banner);
```

For text a widget lets people type in place, mark the element `contenteditable` and `data-sb-rich` and put a `<k-inline-toolbar>` (`/kempo/sitebuilder/components/InlineToolbar.js`) in the page: it floats over selected text with bold, italic, underline and link.

### Rules for widgets

- Style with kempo-css classes: no inline styles and no custom CSS in what a widget writes into a page.
- A page needs JavaScript. Widgets are custom elements that render in the browser.
- Everything a person types is cleaned twice: in the editor as they type, and again on the server before it is stored or written. Rich text allows the tags in `server/utils/sitebuilder/sanitize.js`; address attributes allow `http`, `https`, `mailto`, `tel` and same-site paths only. Embedded frames are never written: the Embed widget builds them for YouTube, Vimeo and Spotify only (`/kempo/sitebuilder/embedProviders.js`).

## For developers

Server code is in `server/utils/sitebuilder/` (opening, saving, resolving a conflict, leaving code mode, rebuilding a tree from HTML, rendering, validating, templates); the code the server and the editor share is in `src/kempo/sitebuilder/` (the tree, the widgets, the renderer, attribute types). Routes are under `/kempo/api/sitebuilder/`, and `/kempo/sdk.js` exposes them (`openSitebuilderPage`, `saveSitebuilderPage`, `resolveSitebuilderConflict`, `leaveSitebuilderCodeMode`, the template functions). Page management gained `copyPage` and `movePage({ overwrite: true })`.
