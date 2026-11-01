# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **A page builder replaces the pages' visual editor.** A page is built from widgets that are added, configured and nested, in the way WordPress blocks work, and is saved as plain HTML. The editor takes the whole screen but the admin navigation: one control bar, a widget tree on the left, the page in an iframe in the middle (with phone, tablet and desktop previews) and the selected widget's settings on the right. It has dragging, multi-select, undo and redo (in the browser, 50 steps), keyboard shortcuts, saved templates, an inline text toolbar and an editor settings dialog. Kempo provides Text, Image, Video, Audio, File, Photo viewer, Hero, Embed, Group, Row and Column, Spacer, Divider, Button, Table, Search, Social icons, Accordion, Tabs, Card, Content slider, Show more, Icon and the server widgets Fragment, Location, Conditional and Repeat. See [docs/sitebuilder.md](docs/sitebuilder.md).
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

- kempo-ui 0.7.2 or later. Its sortable items (the rows of a table of menu links) fill their row and centre vertically.

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
