# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **A page builder replaces the pages' visual editor.** A page is built from widgets that are added, configured and nested, in the way WordPress blocks work, and is saved as plain HTML. The editor takes the whole screen but the admin navigation: one control bar, a widget tree on the left, the page in an iframe in the middle (with phone, tablet and desktop previews) and the selected widget's settings on the right. It has dragging, multi-select, undo and redo (in the browser, 50 steps), keyboard shortcuts, saved templates, an inline text toolbar and an editor settings dialog. Kempo provides Text, Image, Video, Audio, File, Photo viewer, Hero, Embed, Group, Row and Column, Spacer, Divider, Button, Table, Social icons, Accordion, Tabs, Card, Content slider, Show more, Icon and the server widgets Fragment, Location, Conditional and Repeat. See [docs/sitebuilder.md](docs/sitebuilder.md).
- **A Script widget, and the scripts location holds widgets.** A Script loads a script file (its address, type classic or module, defer, async, cross-origin and integrity) or, with no file, runs JavaScript written in a large code dialog; the page gets one `<script>`, and a script file or inline script in a page is read back as this widget. A page's `scripts` location is now a widget location like Content (it shows in the content area switcher), where Script widgets belong, instead of a block of raw code; only `head` stays code, so the **Scripts code** menu item is gone. A page saved before this has its scripts read from its file the first time it opens, so nothing in it is lost, and one the builder cannot read exactly (a script with other attributes, say) opens as code. Whitespace around the whole body of a script no longer counts as a difference between a file and the builder's copy. Needs the server to be restarted.
- **The device buttons use the mobile, tablet and computer icons** (Material Symbols, as the rest of the icon set), replacing the drawn desktop, phone and tablet ones.
- **The Add a widget list has the search focused when it opens, and Ctrl+K (Cmd+K) opens it.** Enter in the search adds the first widget found, so a widget can be added without the mouse. The focus used to go to the dialog's close button.
- **Dragging by the handle on the page keeps the page where it is.** The drop zones that appear push the page down and used to move what you were looking at; the page is now scrolled by the same amount (and back when the drag ends). An empty container, such as an empty Card, shows its "is empty" box as a dashed green drop zone that fills in green under the pointer; it used to draw its outline on the container itself, where the container's own background hid it.
- **Dragging a widget in the tree shows where it will land, in the tree and on the page.** The target row has a strong outline (inside a widget), or a line above or below it, and the same shows on the widget in the page. A widget that can hold others takes the drop inside across the middle half of its row (it was the middle 40%, with a hairline border).
- **An extension's widget shows its own icon file** (`iconSrc`) in the widget tree and the settings panel too, not only in the Add list; and a widget that draws itself in its shadow DOM (kempo-forms' Form) no longer gets the empty placeholder in the page editor.
- **An extension's widget can make its own group in the Add list.** `category` on a page widget is the group it is listed under: one of kempo's, or any other name to make a new group (after kempo's), shared by every widget that uses it. `category_title` sets the group's heading; without one it comes from the name. The Add a widget dialog now fills the screen so long names and many groups fit.
- **The Text widget can be a box.** Settings for **Background** (a color with an opacity, see-through by default), **Text color** (the theme's by default) and **Corner radius**, so text can sit on a hero as white text on a half-transparent black box. With none set the page is exactly the text it was; with any set the text is wrapped in a `<div>` with those styles (and padding, when there is a background), and the page rebuild reads that box back as a Text widget. A new `color` attribute type serves the settings.
- **Every widget has a margin.** The settings of every widget end with a box that has a choice on each side: none, a quarter, a half or a whole space. It is written as the kempo-css classes (`m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml`, each with `h` for half or `q` for a quarter), the shortest set that says it, and classes already on a page are read back as the margin. Text is wrapped in a box when it has one. The server widgets (Fragment, Location, Conditional, Repeat) have no margin, since they are tags and not elements. A side can also be auto: auto on left and right centers a widget narrower than its place, and an image, link or component gets `d-b` with it so it is a block (this needs a kempo-css that has the `.mxa` class). An accordion section and a tab have none, since each is two elements of its widget.
- **Accordion headings are edited in the settings.** Clicking a heading in the page editor opens or closes its section; the heading is typed in the Accordion's Sections list, which also adds sections. A section that is open stays open when the page is redrawn, such as after a change to something inside it. An empty section that is closed collapses fully in the page editor, with no placeholder showing.
- **Empty widgets have a placeholder in the page editor.** A widget drawn with no height is given a dashed box labelled with its name, so it can still be selected and filled in. Dividers are left as they are. An empty container (a section, a card, a group) has its placeholder inside it, so it goes away once something is added, and each one has its own.
- **An HTML widget for code written by hand.** It is shown on the page exactly as it is written, and its settings have an Edit HTML button that opens a large dialog with a code editor. Scripts and styles in it run on the published page but not in the page editor.
- **Table columns have widths.** Each column can be Auto, a percentage of the table or a fixed number of pixels, set in Column widths. The table is written with a `<colgroup>` and reads back the same. A table with no widths is written as before.
- **The Spacer has sizes you can measure.** Small is 2rem, medium 6rem and large 12rem, and Custom takes a height in pixels. In the editor a spacer is a dotted box with its name in muted text, so an empty one can be found. Spacers already on a page keep their place, and take the new sizes when the page is saved again.
- **The Divider has space above and below.** Each can be none, small (2rem), medium (6rem), large (12rem) or custom in pixels, the same sizes as the Spacer. A plain divider is written as before.
- **The Photo viewer is a gallery.** Pictures are added several at a time from the media library (kempo-media's picker takes `multiple: true`), or by URL, with each one's alternative text and move and remove buttons, and **Photos per row**. A page with a single `<k-photo-viewer src alt>` still opens as one picture.
- **The Video widget has the player's options.** Controls (none, minimal, normal, everything), play automatically, loop, muted, remember where the viewer stopped, preload, the skip distance, when the controls hide, a maximum width, a position, an aspect ratio and fit. A video file had no controls at all before. YouTube and Vimeo addresses get the options their players have (`resolveEmbed` takes them as its second argument).
- **Settings components for the widgets that benefit:** Image (full width, aspect ratio, fit and corners, written as a style and a class the person never sees), Button (colour swatches and **Open in a new tab**), Row (layouts that add and remove columns), Column (widths as fractions), Accordion, Tabs and Content slider (their sections, tabs and slides listed with buttons that add them) and Hero (height choice and an overlay slider). `WidgetSettings` gained `renderChoice`, `renderChildren`, `edit` and `select` to build them.
- **A widget can have its own settings component** (`settings_component` and `settings_tag`, extending `WidgetSettings`) shown in the page builder's right panel instead of the fields built from its declared attributes, so a widget can add controls such as the Content slider's **Add slide** button. See [docs/sitebuilder.md](docs/sitebuilder.md).
- **`page_widgets`** in `kempo-config.json` lets an extension declare widgets a page can hold: a native element, or a web component (`tag` and `page_component`), with typed attributes and slots, optionally an `editor_component`. `Widget` and `WidgetEditor` (in `/kempo/sitebuilder/components/`) are the base classes.
- **`sitebuilderPage` and `sitebuilderTemplate` tables**, added to an existing site when the server starts. A page's widget tree is stored with the hash of the file it was last written to; when the file and the tree disagree an admin chooses which to keep, and a page that cannot be rebuilt exactly is edited as code.
- **Copy a page, and replace one with another.** `copyPage` (`POST /kempo/api/pages/copy`) and `movePage({ overwrite: true })` (with a confirmation in the editor) make a draft: copy a page, edit the copy, replace the original with it. A page's builder data follows every copy, move, disable, enable and delete.
- **Sitebuilder SDK and routes**: `getSitebuilderWidgets`, `openSitebuilderPage`, `saveSitebuilderPage`, `resolveSitebuilderConflict`, `leaveSitebuilderCodeMode` and the template functions in `/kempo/sdk.js`, over `/kempo/api/sitebuilder/**`.

### Changed

- **The dashboard widgets key is `admin_dashboard_widgets`.** The old `widgets` key still works as an alias until the next major version.
- The middleware serves `.html` files as `text/html`, and the page builder's frame page may be framed by the admin (`X-Frame-Options: SAMEORIGIN` for that one file).
- Dependencies: `sanitize-html` and `htmlparser2`, used to clean what the builder writes and to read a page back into widgets.
- The admin navigation no longer collapses when Escape is pressed (`esc-close="false"` on its `<k-aside>`), on every admin page. Escape is the page builder's "select the parent" key.

### Added

- **Email stylesheets.** A Styles tab on the Emails page makes, changes and deletes the CSS emails are drawn with. The `default` stylesheet is kempo's light theme written in properties mail clients keep, and cannot be deleted. Each email template picks one on its Templates dialog (default when none). When an email is rendered its stylesheet is filtered for what mail clients drop and cut down to the rules its HTML uses, in place of kempo-css's shake. Routes: `/kempo/api/email-stylesheets` and `/kempo/api/email-templates/style`.
- **Email preview as a mail client shows it.** Template previews and the email log show the email with the CSS a mail client keeps (`server/utils/email/mailClientView.js`).
### Requires

- kempo-ui 0.8.0 or later. It has `<k-audio>` (the Audio widget uses it), `k-html-editor`'s `stylesheet` property and floating toolbar fix (Text widgets inside a Hero), and sortable items that fill their row and centre vertically.
- kempo-css 2.3.0 or later, for the auto margin classes (`.mxa` and the others) that a widget's Auto margin writes.

### Added

- **Editor extensions.** `registerEditorExtension({ nodes, controls })` (in `/admin/component-overrides.js`) lets any number of extensions add custom Lexical nodes and toolbar controls to the page editor's Content editors, instead of replacing the editor as an override does. The nodes go to `k-html-editor`'s `nodes` attribute and the controls to its `toolbar-top-extra` slot. Needs a kempo-ui with URL `nodes` and that slot.
- **Reply-To on email.** `sendEmail` and `sendEmailFromTemplate` take an optional `replyTo` (`name@example.com` or `Name <name@example.com>`; one address on one line, anything else is a 400 before the email is saved). It is kept in a new `replyTo` column of the email log (added to an existing site's table on the next start), shown in **Admin > Emails**, and handed to the `email:send` handler as `email.replyTo` (`null` when there is none), so a retry sends the same header. kempo-resend and kempo-smtp send it as the Reply-To header.
- Admin tabs on Groups, Permissions, Global content, Pages, Templates, Emails and Extensions have a location after their tabs (`admin-groups-tabs`, `admin-permissions-tabs`, `admin-globals-tabs`, `admin-pages-tabs`, `admin-templates-tabs`, `admin-emails-tabs`, `admin-extensions-tabs`), so an extension can add a tab there.
- **Global content page has tabs** for Custom, Extensions and System global content, with hash routing, and each table has a search box that filters by name, location or author.
- **Pages page has tabs** for Custom, Extensions and System pages, with hash routing, and each table has a search box that filters by name, title, URL, description or author on the server. `listPages` takes an optional `q` for the same filter.
- **Templates page has tabs** for Custom, Extensions and System templates, with hash routing, and each table has a search box that filters by name, directory or author.
- **Permissions page has tabs** for Custom, Extensions and System permissions, with hash routing, and each table has a search box that filters by name or description on the server. `getAllPermissions` takes an optional `q` for the same filter.
- **Groups page has tabs** for Custom, Extensions and System groups, with hash routing, and each table has a search box that filters by name or description on the server. `listGroups` takes an optional `q` for the same filter.
- **User search.** The Users page has a search box that filters by name or email on the server, across all pages. `getUsers` takes an optional `q` for the same filter.

### Changed

- **Menus is a table of menus.** Each menu opens its own page (`/admin/content/menus/[id]/`) with its links. The places in the theme, and the menu each one shows, are a **Locations** section above the table, where a location can show **None**. **Create Menu** makes a menu with only a name, and a menu's page ticks the places that show it. A place with no links yet opens by its name in the same address. The default theme and the demo have a footer (`footer-links`).

- **Create Global Content is on the Custom tab**, in its top bar, instead of the page header.

- **Fragments is tabbed** like the other content pages (Custom, Extensions, System), with one list request for all three. **Create Fragment is on the Custom tab**, and extensions can add tabs with the `admin-fragments-tabs` location.

- **Pages loads each tab when it is first shown**, and **Create Page is on the Custom tab** (the top bar). The scan time comes from whichever list loaded.

- **Create Template is on the Custom tab** (the top bar), since only custom templates are made here.

- **Create Permissions is on the Custom tab** (the top bar), since only custom permissions can be made.

- **Permissions loads each tab when it is first shown.** Only the Custom list loads when the page opens; Extensions and System load when their tabs are opened.

- **Groups loads each tab when it is first shown.** Only the Custom list loads when the page opens; Extensions and System load when their tabs are opened.
- **Users table** shows 25 per page by default.
- **Extensions page** is tabbed like the other admin pages: Installed, Downloaded and Browse. The Browse list loads the first time its tab opens. The separate browse page (`/admin/extensions/browse/`) is removed; links to it go to the Browse tab.
- **Name column** on the extension lists is 300px wide.

### Added
- **Marketplace marks.** An extension from the marketplace can be marked official (a green verified icon) or featured (a green workspace-premium icon). The icon sits before the name on the extension browse cards and on its details page.
- **Browse cards have a gap** between them.

### Fixed
- **Updates page has an update-everything button again.** Its "Update selected" control was hidden, so the only way to update all was to tick every row. It now sits in the table's bottom strip, and a button below the table updates every available item.
- **Installing a downloaded extension** whose requirements were not installed failed with "Requires … to be installed and enabled first". The Install button now shows the same list of extensions to install and enable as installing from the marketplace, and installs them all once approved.

## [4.9.7] - 2026-10-25
### Changed
- **Requires kempo-ui 0.7.0.** Admin lists use the kempo-ui `Table` component with its built-in paging, selection and row controls, instead of hand-written tables.
- **Groups, group members, a user's groups, users, fragments, global content, pages, templates and extensions** are tables. A row opens its record, and the edit and open actions are row controls (`kc-tc-open`). The list of pages and templates keeps its one flexible column (name or description), so it takes the spare width.
- **Emails log** is a table with paging. Opening an email is a row control that shows it in the same dialog as before.
- **Email templates** are a table. Preview opens in a new tab, and Edit opens the editor dialog.
- **Updates** is a table with selection. Each row has its own update button, and the bottom control updates every ticked row. Extensions that need a newer Kempo are still only updated together with the Kempo update that provides them.
- **Extension list**: "View in Store" is a row control that opens the marketplace page.

### Removed
- The `admin-extension-details` row control (`tableControls/ExtensionDetails.js`). The extensions list uses `kc-tc-open` with the same destination.

### Kept
- `admin-table-row-link` (`components/TableRowLink.js`) is still served, because extensions that have not moved to `_url` rows still load it.

### Fixed
- The users table no longer scales its fixed-width columns when the Name column has no explicit size. Name takes the spare width.
