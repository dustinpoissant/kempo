# Sitebuilder Plan

## Goal

Replace the built-in WYSIWYG editor with a block-based page builder in kempo core, in the way WordPress blocks work: widgets are added to a page, configured, and nested. Feature parity with the WordPress block editor is the target where practical, and everything planned here is for the first build.

## Scope

- The sitebuilder is part of kempo core, not an extension. It replaces the WYSIWYG editor rather than sitting beside it.
- Pages only for now. Fragments, emails and global content may use it later, so the tree, the renderer and the editor do not depend on the page system. Only the storage is tied to a page, through a content key (the page path today).
- The builder owns everything the current page editor edits: the page metadata, the `head` and `scripts` locations, and every content location. Nothing is split off to a separate editor. `head` and `scripts` are edited as code inside the builder, not as widgets.
- Kempo is alpha, so the builder is the default editor on upgrade, with no opt-in setting and no fallback to the old editor. Backwards compatibility is not a constraint.
- Not in scope: copy and paste of widgets across pages.

## Rules that constrain the plan

- **JavaScript is required, and this is permanent.** The whole site runs on Lit web components. Nothing is designed, compromised or delayed for visitors or bots that don't run JavaScript.
- Styling is kempo-css classes only. No custom CSS and no inline styles, in the editor or in widgets.
- Icons are `k-icon`.
- Use kempo-ui components rather than rebuilding them. kempo-ui already has `k-split` (panels), `k-tree` (widget tree), `k-sortable`, `k-tabs`, `k-dialog`, `k-control-group` (control bar) and `k-icon`.
- Server utils in `server/utils/` are HTTP-agnostic and return `[error, data]` tuples. The routes in `src/kempo/api/` do the request handling.
- Edit `src/`, never `dist/`.
- Admin UI follows the kempo-ui conventions skill.
- Any behaviour change updates README and CHANGELOG.

## How it fits together

- The page file is the source of truth for what is served. It is plain HTML, so kempo-server serves it with no render step.
- The builder's source of truth is a JSON widget tree, `{ id, type, attrs, slots: { name: [nodes] } }`, stored in the database, keyed by content key. The tree is only read when someone edits the page, so database reads are not a concern.
- Saving renders the tree to HTML, writes the file, and stores the tree with the hash of what was written.
- Opening a page for editing compares the file with the stored hash. A mismatch means the file was changed outside the builder, and is handled by the sync rules below.
- Widgets are tags in the file. Their attributes are the real attributes of the tag, so the rendered page carries them as they are.
- The editor shows the page in an iframe so the site's theme applies and the admin's does not.

## Widgets

### Types

A widget is one of three types, by what its page side is:

- **Primitive**: a native element such as `<hr>` or `<img>`. The declaration gives a `tag` and there is no page JavaScript.
- **Component widget**: a web component on the page. The declaration gives the `tag` and a `page_component`, the path to the file that defines it. The path can point anywhere: into kempo-ui (`/kempo-ui/components/Accordion.js`), into kempo, or into an extension. Nothing is wrapped or re-exported. The `tag` is always declared because the rebuild maps tags back to widgets.
- **Server widget**: renders to one of the server template tags, which the server resolves on each request. Built into kempo only. See Server widgets.

Who ships a widget, kempo or an extension, is not a type. The documentation can group them that way, so kempo's bundled widgets are described apart from what an extension author writes.

### Declaring a widget

- A new `page_widgets` key in `kempo-config.json` lets an extension declare widgets that can be placed on pages. Widgets are registered at install into a table, following the `dashboardWidget` precedent.
- A declaration gives the widget's key, title, the attributes (settings) it accepts, its `tag`, and `page_component` for a component widget. For the inserter it also gives an icon, a category, a description and keywords.
- `editor_component` is the path to the web component used inside the admin editor. Primitives and component widgets can leave it out: kempo then supplies a generic editor that shows the real page element in the iframe, handles focus and selection, and edits the declared attributes. A widget with editable text names the parts that are editable.
- `slots` lets other widgets be placed inside a widget, so widgets nest. Nesting is capped at 100 levels as a safeguard against runaway nesting, such as a loop in the tree. It is not a design limit.
- Some library components need paired children, not one tag. A kempo-ui accordion item is a `k-accordion-header` plus a `k-accordion-panel` sharing an id, and a tab is a `k-tab` plus a `k-tab-content`. Such an item widget renders to more than one element, so its declaration needs a small output template, and the rebuild has to recognise the pair.
- The existing `widgets` key (admin dashboard tiles) is renamed `admin_dashboard_widgets`. `widgets` keeps working as an alias until the next major release.

### Components and attributes

- Kempo core provides two base classes, `Widget` (the page side) and `WidgetEditor` (the editor side). Extension components import and extend them.
- The two components should look nearly identical. The editor version can use `contenteditable` for editable text, and changes flow back into the widget's data, which later generates the published markup.
- Declared attributes are set as plain attributes on the web component, in both the editor and the page.
- Attribute types are a registry. Core ships `string`, `number`, `boolean` and `image`. Each type knows how to draw its field in the attribute editor and how to validate its value. Extensions can add types the same way.
- The `image` type uses the media library when kempo-media or kempo-files is installed, and a URL field otherwise.
- The editor version is focusable. When it takes focus it emits an event on the page editor component, and the attribute editor then edits that widget's attributes.
- Editable text and rich text are child nodes in a widget's default slot (`text` and `html` leaves), rendered as light DOM inside the tag. The rebuild parses them back the same way.
- The renderer adds the page-side script for each widget a page uses, and drops it when the last such widget is removed.
- A tag whose extension is missing opens as an unknown-widget block with a visible warning. It keeps its markup exactly as it was and can be moved or deleted, but not edited. Attributes the config no longer declares are kept. This keeps a disabled extension from forcing its pages into code mode.
- There is no raw HTML widget. Someone who needs markup or JavaScript that no widget offers makes a widget for it in their own extension, or skips the visual editor and uses the code editor.

### Server widgets

- A server widget renders to one of kempo's server template tags. The page file keeps the tag, so serving stays a plain file read.
- Built into kempo core, one each:
  - **Fragment**: `<fragment name="…" />`. The `name` is picked from the fragments that exist, including ones extensions ship. Use: a disclaimer or notice placed on many pages and edited in one place.
  - **Location**: `<location name="…" />`. Use: a place other extensions fill, as the blog does today for its post list.
  - **Conditional**: `<if condition="name">`, with the condition as an attribute (a variable name, `!` to negate) and its contents in a slot.
  - **Repeat**: `<foreach in="lines" as="line">`, with the source variable and the item name as attributes and its contents in a slot.
- Conditional and Repeat can only use the variables the server has for a page: the attributes on the page's `<page>` tag, the site globals, and the built-ins (`year`, `date`, `datetime`, `timestamp`). The attribute editor offers these as a list to pick from, and also accepts a typed name. Repeat needs a variable that holds a list.
- In the editor a server widget is a labelled placeholder showing its attributes, since the server is not resolving anything there. Conditional and Repeat still hold other widgets in their slot, so those stay editable.
- Extensions do not declare server widgets. They expose fragments and locations, which the Fragment and Location widgets can already place.
- Server widgets exist for content that comes from the server. They are not there to serve visitors without JavaScript.
- `{{ }}` variable embeds are allowed in text anywhere and are kept as typed. The template tags (`<if>`, `<foreach>`, `<fragment>`, `<location>`) only come from server widgets, never from typed text: the Markup widget does not keep them. This adds no privilege, because anyone who can edit a page already writes these in code mode.

## Default widgets

The widgets for the initial build. More will be added as the sitebuilder matures.

### Primitives

- Divider (`<hr>`), Spacer (a `<div>` with size presets as kempo-css classes), Audio (`<audio controls>`), File (an `<a download>` with a label).
- Image (`<img>`: src, alt, width) and Button (`<a class="btn …">`: href, label, color).
- Group (`<div>` with a slot, and kempo-css class presets for padding, background and alignment). Group keeps any classes it doesn't recognise, so hand-written `<div class="…">` still rebuild.
- Columns (`<div class="row">` with one slot per column, using kempo-css `span-N` classes with `m-span-12` so they stack on mobile). Presets: 50/50, 60/40, 40/60, 33/33/33, 25/25/25/25.

### Component widgets using existing kempo-ui components

Accordion, Tabs, Card, Card grid, Content slider, Photo viewer, Show more, Icon, and Video (a file or a YouTube or Vimeo address).

### Component widgets with a new page component

- **Markup**: the one widget for all text: paragraphs, headings, lists, quotes, code blocks and inline formatting. It edits with kempo-ui's `k-html-editor` with the code view left out, so it is visual only. HTML is the natural fit because the page file is HTML; `k-markdown-editor` would make the stored text lossy to rebuild. Paragraphs, headings and lists are not separate widgets, because that would make the rebuild ambiguous: a `<p>` could be either.
- **Hero**: `image`, height (full screen, tall, medium), overlay darkness, and one slot. It has to be a component because kempo-css has no background-image class and inline styles are not allowed.
- **Embed**: takes an address and builds the iframe itself for an allowed provider (YouTube, Vimeo, Spotify and so on), so the page file never holds a raw iframe and the sanitizer never has to allow one.
- **Social icons**: a row of icon links.
- **Table**: static content with editable cells (not `k-table`, which is data-driven).
- **Search**: a search box.

### Server widgets

Fragment, Location, Conditional and Repeat.

## Storage and sync

### The database row

- Rows live in their own table, not an existing one. Its schema is declared in Drizzle under `server/db/`, which is a kempo core schema change. Core has no pages table today, because pages are only files.
- A row stores the tree, the hash of the file the tree corresponds to, `saved_at`, and whether the page is code-only.
- Rows are keyed by content key, which is the page path for now. Other content types later get their own key.

### Opening a page

- If the file's hash matches the row's hash, the editor opens from the tree.
- If there is no row (a page copied or deployed without one), a tree is rebuilt from the file and written to the database on open. This is the only case with no choice to make.
- If the hashes differ, the editor rebuilds a tree from the file and checks it: it renders the tree back to HTML and compares the result with the file. A match means the rebuild is exact.

### Rebuilding a tree from a file

- Each known tag becomes its widget, with its attributes taken from the widget's config. The server template tags become server widgets.
- A run of adjacent text tags (`<p>`, `<h1>` to `<h6>`, `<ul>`, `<ol>`, `<blockquote>`, `<pre>`) becomes one Markup widget. Two Markup widgets placed side by side therefore come back as one after a reload, with no visible difference.
- Anything that cannot be represented, such as a script, an iframe or an unknown native tag, cannot be rebuilt, so the page opens in code mode.
- A rebuilt page matches its file in meaning, not byte for byte. Whitespace, attribute order and quote style are ignored, because they don't change what the page shows. Whitespace inside `<pre>` and between inline elements still counts where it changes the rendering.
- A page whose file holds anything the sanitizer would change is not rebuilt, and opens in code mode.

### When the file and the row disagree

- An admin with permission to edit the page gets a dialog explaining the mismatch. Viewers without edit permission never see it.
- The dialog offers the two versions, each with a preview, and shows what changed since the last save. It shows `saved_at` for the row and the file's modified time, but the modified time does not decide the winner, because a redeploy that copies files gives them new times.
- Choosing a version saves both sides at once, straight away:
  - Keep the file: the file is reversed into a tree and the tree is saved to the row. If the reverse cannot be checked exactly, the dialog warns before the choice is made that the page will only be editable in the code editor. Continuing saves the file and a code-only row. Any tree the row already had is kept as the last known good page.
  - Keep the row: the tree is rendered to HTML and written to the file.

### Code mode

- A page the rebuild cannot reproduce exactly opens in code mode, with the code editor (`k-code-editor`). It is a safety valve, not a second editor.
- Leaving code mode for the builder asks for a confirmation, with two options:
  - Start over: the builder starts from an empty tree, and the page is wiped.
  - Start from the last known good builder page: the stored tree is loaded. Only offered when the row has a stored tree.

### Saving and conflicts between editors

- Save sends the hash the editor loaded. If the file or row has changed since, the server refuses and the conflict dialog is shown. This stops a second admin silently overwriting the first.
- Save publishes immediately. There is no draft system. To work on a draft, copy the page, edit the copy (an unlinked page can be previewed by its URL), then replace the original with it.
- That needs two additions to page management: a copy-page action, and a move that can overwrite an existing page after a confirm (move refuses today with a 409).
- The row follows every change of path: copied with a copy, moved with a move, replacing the target's row on a replace, following a disable and enable (`.page-disabled.html`), and deleted with the page.

## Page editor

The page editor is a Kempo core component, not a page of its own markup. It plugs in through the existing override seam (see Existing code).

### Layout

- **Control bar** across the top, in `k-control-group`s:
  - add, remove, move into, move out, move up, move down;
  - duplicate widget, save as template, insert template;
  - open and close the widget tree and the attribute editor;
  - mobile, tablet and desktop preview buttons;
  - a switcher for the page's content locations;
  - Save, Undo, Redo;
  - a settings button that opens a dialog.
- **Widget tree** on the left (`k-tree`): the page's widgets as a nested tree.
- **Page content** in the middle: an iframe showing only the content of the location being edited, styled by the site, without the template's header and footer. It is same-origin, so the theme saved in localStorage carries into it; use kempo-ui's theme util. The preview buttons resize it.
- **Attribute editor** on the right: edits the attributes of the focused widget. With several widgets selected it shows nothing to edit.
- Both side bars open and close from the control bar.

### Selection and editing

- The first click on a widget in the page content focuses it. That highlights it in the widget tree and scrolls it into view there, loads its attributes into the attribute editor, and makes it the widget the control bar acts on.
- Further clicks inside the focused widget are normal editing: they place the text cursor and do not change the selection.
- Multi-select is limited to widgets that share a parent and slot, as in WordPress. Move, duplicate, delete and save as template work on the whole selection.
- Inline text toolbar: core exports a basic one that widget authors import for their editable text, styled like the kempo-ui controls (it may be one). The default widgets use it.
- The inserter is searchable and shows each widget's title, icon, category and description. A new widget goes after the focused one, or into its default slot if the focused widget accepts it, or at the end of the page if nothing is focused.

### Dragging

- Widgets are draggable in the page content, as in WordPress, and the control bar move buttons work too.
- The widget tree and the page content are separate drag surfaces that edit the same tree data. Dragging does not cross from the tree into the iframe, as in WordPress.
- Drop targets have to be found at every nesting level, including into and out of slots. `k-sortable` handles a flat list and may not cover nested drops.

### Undo, redo, save and unsaved changes

- Undo and redo are browser-only snapshots of the tree. Each edit pushes an immutable copy. The history is not saved anywhere: a reload clears it, and unsaved changes are lost with it. It holds at most 50 changes; the oldest drop off first.
- Save is explicit and stays on the page. It clears the dirty flag but not the undo history.
- While the tree is dirty, the editor uses `beforeunload` to ask the user to save before a reload or close. If they choose to leave anyway, the unsaved work is lost. That is their choice.

### Templates

- Saved templates are stored in the database, in their own table. A button saves the selected widget and its children as a template, and a button opens a dialog to insert one.
- Inserting makes a copy with new ids. It is not linked back, so editing a template later does not change pages that used it. Content to edit in one place and share uses the Fragment widget instead.

### Keyboard shortcuts

These are beyond the text shortcuts `contenteditable` already gives. On a Mac, Ctrl means Cmd.

- Ctrl+S saves.
- Ctrl+D duplicates the selected widget. The editor cancels the browser's bookmark shortcut while it has focus.
- Escape moves the selection from the text up to its widget.
- Delete removes a selected widget when the cursor is not in text.
- Alt+Shift with the arrow keys moves the widget: up and down in its list, left to leave its parent, right to enter the one before it. Alt+Left and Alt+Right alone are browser back and forward, so they are not used.
- Ctrl+Z undoes. Ctrl+Shift+Z, Ctrl+Shift+Y and Ctrl+Y all redo, so whichever convention a person knows from other apps works. They act on the tree only when the cursor is not in editable text. Inside text they stay the text's own undo, so one key never does two things.

### Settings

The settings dialog is kept per browser in localStorage. The first setting is "Confirm deletion", off by default, which asks before the Delete key or the remove button deletes a widget.

## Security and permissions

- Sanitize in both the browser and the server, as far as possible. Rich text and attribute values are sanitized in the editor as they change, and again on the server before the tree is stored and before the HTML is rendered and written. The browser pass stops mistakes and most abuse; the server pass is the real guard, since anyone can change browser code. Both passes use one allowlist. The browser pass can use kempo-ui's `sanitizeHtml`, and the server pass can use `sanitize-html`, which kempo-forms already depends on.
- The sanitizer applies only to what the builder edits (widget attributes and text). Code mode and the `head` and `scripts` locations are not sanitized, as in the page editor today.
- The page file never holds a raw iframe or script from the builder: iframes only come from the Embed widget, which builds them for allowed providers.
- The builder uses the existing page edit permission and respects locked pages and `owner`. There are no per-widget permissions in the first build.

## Existing code this builds on

- The page editor is `src/admin/components/PageEditor.js`. It creates the content editor with `getComponentOverride('page-content-editor', 'k-html-editor')`, so the sitebuilder plugs in through the existing override seam (`src/admin/component-overrides.js`) rather than patching PageEditor.
- The override contract today is: a `.value` property holding the HTML, a `getValue()` method, and a `disabled` attribute. The sitebuilder must meet this contract with HTML output, or the contract changes when it replaces the WYSIWYG.
- The admin's `k-html-editor` is Lexical, bundled into `dist/kempo/vendor/lexical/`. It stays in use for fragments and emails until the sitebuilder is extended to them, and the Markup widget uses it without its code view.
- Page management lives in `server/utils/pages/` (`createPage`, `movePage`, `disablePage`, `deletePage` and others) with routes under `src/kempo/api/pages/`. Page files are a frontmatter comment, a `<page template title>` wrapper, and several `<content location="…">` blocks.

## Build order

1. Storage: the database table, the row's hash and sync rules, and the copy and overwrite-move additions to page management.
2. The `page_widgets` registry and declaration.
3. The `Widget` and `WidgetEditor` base classes, the generic editor, and the attribute types.
4. The page editor shell: control bar, widget tree, iframe, selection and the attribute editor.
5. Save, undo and redo, the conflict dialog and code mode.
6. Rendering and rebuilding: the tree to HTML, and HTML back to a tree.
7. The default widgets, which prove the whole loop.
8. Templates, the settings dialog and keyboard shortcuts.

## To check during the build

- Whether `k-sortable` handles nested drops.
- Which `k-html-editor` control provides the code view, so it can be left out of Markup.
- Whether `k-html-editor` can already do tables. If so, Markup covers Table and the Table widget is dropped.
- Whether the kempo-ui icon set has the brand icons Social icons needs.
- Whether there is a site search for Search to point at. If not, Search waits until there is.
- Whether extensions can add globals that hold lists, which Repeat needs.
- Whether fragments accept parameters, which an extension's server-rendered piece would need.
