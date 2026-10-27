# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Requires

- kempo-ui 0.7.2 or later. Its sortable items (the rows of a table of menu links) fill their row and centre vertically.

### Added

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
