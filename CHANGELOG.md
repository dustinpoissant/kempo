# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.16.0] - 2026-11-14

### Added

- **Kempo tells people about their own account.** Changing a password (`changePassword`) or resetting it with the emailed link (`resetPassword`) raises a toast that expires in ten minutes, so it shows on whatever page the person lands on next, and a notice that stays in their history with a link to reset the password if it was not them. An administrator changing someone's email address (`updateUser`) raises a banner, a warning that must be acknowledged, saying what it was and what it is now; changing it again refreshes the same banner. They are raised by the utilities, so every way of making the change gets them, and one that cannot be raised never fails the change. See docs/notifications.md.

### Changed

- The change password and reset password forms show the notification's toast, which survives a redirect, instead of a toast of their own.

### Fixed

- Resetting a password signs the person in, and now merges their guest session like a login or registration does, instead of leaving it behind.
- `updateUser` answered a `500` instead of a `409` when the email address was already in use, because the database error is wrapped and its code was not found.

## [4.15.0] - 2026-11-13

Requires a restart once: the new columns are added and the old state carried over when the server starts. A public site loads `/kempo/notifications/client.js` from its template to show toasts, banners and modals (see docs/notifications.md).

### Added

- **Notification types, shown on the next page.** A notification has a `type`: `notice` (the default, in the bell), `toast`, `banner`, `modal` (blocking, with no way out but its buttons) and `inline` (where a page places `<k-notification-inline>`), or any word of an extension's own, which core ignores and the extension's own component handles through `subscribe(type, handler)` from `/kempo/notifications/client.js`. A `subtype` (`success`, `error`, `warning`, `info` colour kempo's own, any other word is free), a `priority` (a modal first, then higher priority), `mustAcknowledge` with a `cooldownSeconds`, `displaySeconds` for a toast and an optional `expiresAt` are new options of `createNotification`, and `level` remains as the older name of `subtype`.
- **The notification client** (`/kempo/notifications/client.js`) asks the server for what to show the moment a page loads and then every `system:notification_poll_seconds` (default 10, at least 1), and again when the window is focused or the tab becomes visible. It draws toasts (kempo-ui's `Toast`; viewed when they time out, so leaving early shows them again on the next page), banners at the top of the page content (one at a time, viewed after the banner time) and modals, reports what happened, and hands every other type to its subscribers. The admin and the public template load it. A public template that was never edited gets the line with the update, like any starter file; one that was edited needs it added by hand.
- **Per-person state as timestamps**: `deliveredAt`, `viewedAt`, `acknowledgedAt`, `dismissedAt` and `lastShownAt`, with a status (`pending`, `delivered`, `viewed`, `acknowledged`, `dismissed`) worked out from them, and `expired` by the clock. They replace `readAt` and `handledAt`; kempo carries the old state over when the server starts (`4.15.0-notification-state-timestamps`), and `markRead`, `markAllRead` and `markHandled` remain as the older names of `markViewed`, `markAllViewed` and `markAcknowledged`.
- **Guests can be notified.** `createNotification` takes `guestSessionIds`, a guest's notifications have the same state and functions as a user's (`getNotifications`, `getPendingNotifications` and the rest take `{ userId }` or `{ guestSessionId }`), and the notification routes work with the login cookie or the guest cookie (`resolveRecipient`). They move to the account at login with their state.
- **Routes**: `GET /kempo/api/notifications/pending`, `POST .../delivered`, `POST .../:id/shown`, `POST .../:id/viewed` and `POST .../:id/acknowledge`; the list takes `status` and `type`, and the count takes `type`. `.../:id/read` and `.../:id/handled` are replaced by `viewed` and `acknowledge`. The browser SDK's `markNotificationRead`, `markNotificationHandled` and `markAllNotificationsRead` are now `markNotificationViewed`, `markNotificationAcknowledged` and `markAllNotificationsViewed`.
- **History.** Dismissing now hides a notification but keeps it, and `<k-notification-history>`, the `/notifications/` page (open to guests, since `/account` needs a login) and a page builder widget show everything a person was sent, with a choice of kind and status, until the retention removes it.
- **`<k-notification-inline>`** and the **Notification history** and **Notification messages** page builder widgets; the Notification list widget takes a `type`.
- A **Notification bell** menu item (`kempo:notifications`) is offered on every site's Menus page next to the spacer, for a site whose navigation file was edited and so does not get the bell with an update.
- Settings: `system:notification_poll_seconds` (10), `system:notification_cooldown_seconds` (180), `system:notification_toast_seconds` (10), `system:notification_banner_seconds` (10).

### Changed

- **A starter file the admin only saved, or that has Windows line endings, is still the default.** The fingerprint kempo keeps of each starter file (`.kempo/shipped.json`) used to be of the exact bytes, so a template or fragment that the admin had saved without changing anything (it stamps `updated` into the frontmatter) counted as edited and never got an update again. It now ignores line endings, whitespace at the ends, the order and indentation of the frontmatter, and the frontmatter's `updated`, `created`, `author` and `name`; anything else is still an edit and is kept. Records made by older versions still work. This is what delivers the notification client's script tag to a template nobody changed. See docs/updates.md.
- `<k-notification-bell>` counts the notices a person has not viewed, for guests as well as signed-in people, takes its count from the client and has no timer of its own (its `interval` attribute is gone), and opening it marks the notices on screen viewed one second later. The "Notifications" admin page shows the history.
- `notification:created` carries `guestSessionIds`.

## [4.14.0] - 2026-11-13

### Changed

- The `kempo-server` peer dependency is now `>=3.6.1`, which fixes `clearCookie` so a cookie is actually expired (the guest cookie is cleared at login and registration).

### Added

- **Guest sessions**: a visitor who has not logged in is a guest, tracked by an `httpOnly` `kempo_guest` cookie that their first page request starts (a GET that asks for HTML; not a file, an API call, or someone already logged in). A guest is a session in the new `guestSession` table, never a user: it satisfies no login or permission check. `request.guest` is `{ token }` for routes that accept guests. When a guest logs in or registers, everything it owns moves to the account in one transaction, the guest cookie is cleared, and the `guest:merged` hook (`{ tx, guestSessionId, userId }`) lets an extension move what it keeps; a handler that throws undoes the merge and refuses the login. `guest:expired` (`{ tx, guestSessionId }`) fires before an unmerged guest is deleted. Notifications sent to a guest are rows in the new `notificationGuestRecipient` table and move to the user at login. Guests unused for `system:guest_idle_days` (default 60) are deleted by a daily job; `system:guest_session_days` (default 30) is the cookie's life. New permissions `system:guests:view` and `system:guests:manage`, an admin **Guests** page under Accounts, `GET /kempo/api/guest`, `GET /kempo/api/admin/guests` and `DELETE /kempo/api/admin/guests/:token`. SDK: `createGuest`, `getGuest`, `mergeGuest`, `mergeGuestIntoLogin`, `deleteGuest`, `listGuests`, `pruneGuests`, `GUEST_COOKIE`. The response that sets or renews the cookie is `Cache-Control: private, no-store`. See [docs/guests.md](docs/guests.md). Existing sites get the tables, settings and permissions when the server starts.
- `guest:merged:committed` (`{ guestSessionId, userId, results }`) fires after a guest merge commits, with what each `guest:merged` handler returned. A rolled-back merge never fires it.
- `planHook` and `triggerPlannedHook` in the SDK: read an event's handlers before opening a transaction and fire it inside, which the in-process test database needs.

## [4.13.0] - 2026-11-12

### Added

- **Restrict a page in its frontmatter**: `require-login: true`, `require-permissions: a || (b && c)` (`&&`, `||` and parentheses, `&&` first; administrators pass) and `login-required-redirect: /somewhere` and `permission-denied-redirect: /somewhere`. Someone not signed in goes to `login-required-redirect`, or to `/login?next=` the page when it is not set; someone signed in without the permissions goes to the redirect, or gets a `403`. A page whose expression cannot be read is refused with a `500`, never shown. Restricted pages are sent `Cache-Control: private, no-store`. The check is `server/utils/pages/checkPageAccess.js`, and the expression is `server/utils/permissions/evaluatePermissionExpression.js`.
- **`<k-permission logged-in>`** shows its content only to signed-in people, using the SDK's session request so it is shared with other components. It can be combined with `has`, `all` or `some`, and is a setting of the "Show for permission" page builder widget.
- **Site commands on the `kempo` CLI**, run from a site's folder with its `.env`: `npx kempo make-admin [email]`, `npx kempo remove-admin [email]`, `npx kempo test-email <email>`, `npx kempo db <generate|migrate|push|studio>` (drizzle-kit with the site's `drizzle.config.js`) and `npx kempo reset-db [-y]` (asks for `RESET` first). The scripts are in the published package now; `make-admin.js` was not, so `node node_modules/kempo/scripts/make-admin.js` never worked for a site.
- The email argument of `make-admin.js` and `remove-admin.js` is optional; without it they ask for one, as before.

### Changed

- The `kempo-server` peer dependency is now `>=3.6.0`.

## [4.12.0] - 2026-11-12

Requires kempo-ui 1.5.0 or later.

### Changed

- The `kempo-ui` peer dependency is now `>=1.5.0`. kempo-ui 1.5.0 makes every form input read-only-capable: a read-only input shows its value and keeps it in the form, but cannot be changed. The admin and the page builder pick it up with no change to kempo.

## [4.11.0] - 2026-11-09

### Added

- **The Register form asks for the password twice.** A **Confirm Password** field is checked in the browser before anything is sent, and a mismatch is shown on that field.
- **The pages that come with kempo open in the page builder as widgets.** The home page, 404, login, register, forgot password, reset password, verify email (and its link page), delete account and account are made of widgets (the new account widgets, Columns, Text, Button and Location), and a new site gets them as editable pages instead of one HTML widget holding all of the content. Their widgets are in `src/kempo/pagebuilder/systemPages.js`, the page files in `app-public/` are what those render to (`npm run build:pages` writes them, and a test keeps them in step), and `openPage` opens a page that still holds exactly what its widgets render to as those widgets. A page that has been changed is taken as it is, as before, and a page whose row only holds the file as one HTML widget (opened before it had widgets) gets its widgets the next time it is opened. The two link pages in `[token]` folders (reset password and verify email) have a pre-rendered `index.html` that the server serves before the page file, so `npm run build:pages` refreshes those too. Login and register keep their `login-form-after` and `register-form-after` places for other extensions, and the account page its `account-details` and `account-links` ones.
- **A Verify email widget** (`<k-verify-email>`), the page the emailed link opens, now an element like the other account pages' forms, with `redirect` and `login-href` settings.
- **The Location widget has a Label setting**, written as the `label` attribute, which is how a place is named when someone chooses where to add content. The **Logout button** and **Change password button** are plain kempo-css buttons, like the Button widget: `<button class="btn" data-logout data-redirect="/login">` and `<button class="btn" data-change-password>`, with a `color` setting and nothing around them, so the Styles tab's margin, alignment and color classes go on the button itself and line up with any other button. One script for each (`LogoutButton.js`, `ChangePasswordButton.js`) makes every such button on the page work. While editing in the page builder they are links that do nothing. `<k-change-password-dialog>` is the form alone, opened with `open()`. Show for permission draws no box of its own (`display: contents`), so what is inside lines up as if it were not there. A button with a margin only below it (`mb`) still sits higher than one with none, as for any button, so the account page and the links kempo-commerce, kempo-credits and kempo-store-credit add to it all carry the same `mb mrq`.
- **kempo's own functions are page builder widgets**, in a new **Account** group: **Login form**, **Register form**, **Forgot password form**, **Reset password form**, **Change password button**, **Delete account form**, **Logout button**, **Signed-in name**, **email**, **email verified** and **member since**, **Notification bell** and **Notification list**, and **Show for permission** (in the Server group). They are the elements the pages that come with kempo are made of, so those pages can be changed in the page builder and the same pieces can go on any page. The definitions are in `src/kempo/pagebuilder/coreWidgets.js` (registered on the server and in the admin, like the server widgets). In the builder each draws as it does on the page but never signs anyone in or out or sends a form (`src/admin/components/pagebuilder/CoreWidgetEditors.js`), and what is inside Show for permission is always shown. A page needs a restart of the server to save them.
- **New elements for what was page script:** `<k-forgot-password>`, `<k-reset-password>`, `<k-change-password>` (a button that opens the form in a dialog) and `<k-delete-account>`. The pages that come with kempo (`app-public/forgot-password`, `reset-password/[token]`, `delete-account` and `account`) now use them and have no form code of their own; a site made before this keeps its own copy of those pages, which still works, and can swap in the elements. `<k-logout-btn>` takes its text from a `label` setting as well as from what is inside it.
- **The page builder's File widget address uses the media library.** The file picker opens the library with every type, and the server accepts the new `file` setting type as an address, checked the way a link is (`validateTree`). It needs a restart of the server to take effect there.
- **Ctrl+S (Cmd+S) saves on every admin page that has a Save button.** One handler in the admin's `init.js` presses the page's visible Save button (one marked `data-save`, or else the one whose label starts with "Save") and stops the browser's "save page" dialog, so extensions' pages get it with no code. It leaves alone a key an editor already handled (the page, template, fragment and global content editors and the page builder keep their own), one pressed while a dialog is open, and a page with no Save button or several. Documented under Admin Pages in the extension guide.
- **`hide_styles` in an extension's page widget.** A widget that has its own setting for something the Styles tab also offers (an Add to cart button's colour is its `variant`) lists the parts to hide (`box`, `background`, `textColour`, `align`, `id`, `classes`), as kempo-ui's own widgets do with `hideStyles`. An unknown part skips the widget, and the server log says why.
- **`suggestedPeers` in an extension's kempo-config.json.** An extension that works without another one but does more with it (kempo-products with kempo-media, kempo-forms with an email extension) can suggest it, as names or `{ name, reason }`. Right after an install or an enable, the admin offers a **Works well with** dialog listing what the site does not run yet, each unticked, and **Add selected** installs (or enables) what was ticked. It covers everything the action added, the extensions it needed included, merged into one list. Advice only: nothing is required or installed on its own, unlike `dependencies`. New: `GET /kempo/api/extensions/suggested?names=a,b`, `getSuggestedExtensions(names)` (browser SDK) and `getSuggestedPeers({ names })` (server SDK). kempo-products, kempo-forms, kempo-inventory, kempo-credits and kempo-commerce declare theirs. The marketplace catalogue does not carry it yet, so it is read from the installed package.


- **The page builder is kempo-ui's `<k-page-builder>`.** Pages are built from widgets that are added, configured and nested, in the way WordPress blocks work: a control bar, the widget tree on the left, the page in an iframe in the middle (phone, tablet and desktop previews) and the selected widget's settings on the right. kempo-ui provides Text, Markdown, Image, Video, Audio, File, Photo viewer, Media gallery, Hero, Embed, Group, Fullscreen breakout, Container, Columns, Spacer, Divider, Button, Table, HTML, Script, Accordion, Tabs, Card, Content slider, Show more and Icon (see its changelog); kempo adds the server widgets **Fragment**, **Location**, **Conditional** and **Repeat**. Kempo adds what only a CMS has around the builder, as kempo-ui controls in the builder's own control bar (the page's actions are the first to move into the bar's "more" menu when it is narrow), and the page's name and template are fields in the builder's page settings panel (the right panel while no widget is selected), not a dialog: the content areas of a page's template (a switcher in the control bar, kept in the address hash), the page's name and template, the head code, copy, move, replace and delete page, templates stored in the database, and the conflict dialogs. See [docs/sitebuilder.md](docs/sitebuilder.md).
- **A page the builder did not write is taken as it is.** Opening a page that has no builder copy (a page written by hand, by an earlier kempo or by another tool) turns the content of each content area into one HTML widget, written back exactly as it was, so nothing in the page is changed or lost and all of it can be edited. A page with something outside its content blocks cannot be kept that way and is edited as code.
- **Page widgets are kempo-ui widget definitions.** `page_widgets` in `kempo-config.json` still declares an extension's widgets (`key`, `title`, `tag`, `page_component`, optionally `editor_component` + `editor_tag` and `settings_component` + `settings_tag`, `attributes`, `slots`, `category`, `category_title`, `icon` or `iconSrc`, `keywords`); the server turns each into a kempo-ui widget named `<extension>-<key>` (`kempo-forms-form`), which is the name a page stores. A page component extends kempo-ui's `ShadowComponent`, an editor component `pagebuilder/WidgetEditor` and a settings component `pagebuilder/WidgetSettings`. See [docs/sitebuilder-widgets.md](docs/sitebuilder-widgets.md).
- **Settings for the server widgets.** Fragment is chosen from a list of the site's fragments (with a link to edit it), and Conditional and Repeat suggest the page's values (its `<page>` attributes and the built-ins) as you type. They are admin components (`ServerWidgetSettings.js`); the server widgets themselves still import nothing.
- **The server checks every tree it is sent.** `validateTree` keeps only widgets the site has, only the settings each declares (cleaned by their type: numbers within their limits, selects from their options, addresses a page may link to, icons as a name or `src:` and the path of an SVG), ids that are well formed and unique, and a tree of at most 5000 widgets. A widget the site does not have now (its extension is off) is kept in the builder's copy and left off the page, so turning the extension off and on does not lose it.
- **An icon picker for any extension.** `GET /kempo/api/icons` lists every icon the site can use: the site's `public/icons`, kempo's and kempo-ui's own sets, and each enabled extension's public icons (under each scope it claims) and admin icons. `?q=` matches part of a name and `?source=` limits it to one source. `<k-icon-picker>` (`/kempo/components/IconPicker.js`) chooses one from that list, as a form input that fires `change`. The page builder has an `icon` attribute type that uses it, so an extension declares `{ "type": "icon" }` and gets the picker in its settings panel.
- **Copy a page, and replace one with another.** `copyPage` (`POST /kempo/api/pages/copy`) and `movePage({ overwrite: true })` (with a confirmation in the editor) make a draft: copy a page, edit the copy, replace the original with it. A page's builder data follows every copy, move, disable, enable and delete.
- **`sitebuilderPage` and `sitebuilderTemplate` tables**, added to an existing site when the server starts, each with a `format` column. A page's widget tree is stored with the hash of the file it was last written to; when the file and the tree disagree an admin chooses which to keep. Rows and templates from before kempo-ui's page builder (format 1) are not used: the page file is the truth and is taken as it is, and old templates are not listed.
- **Sitebuilder SDK and routes**: `getSitebuilderWidgets`, `openSitebuilderPage`, `saveSitebuilderPage`, `resolveSitebuilderConflict`, `leaveSitebuilderCodeMode` and the template functions in `/kempo/sdk.js`, over `/kempo/api/sitebuilder/**`.


- **Email stylesheets.** A Styles tab on the Emails page makes, changes and deletes the CSS emails are drawn with. The `default` stylesheet is kempo's light theme written in properties mail clients keep, and cannot be deleted. Each email template picks one on its Templates dialog (default when none). When an email is rendered its stylesheet is filtered for what mail clients drop and cut down to the rules its HTML uses, in place of kempo-css's shake. Routes: `/kempo/api/email-stylesheets` and `/kempo/api/email-templates/style`.
- **Email preview as a mail client shows it.** Template previews and the email log show the email with the CSS a mail client keeps (`server/utils/email/mailClientView.js`).


- **Editor extensions.** `registerEditorExtension({ nodes, controls })` (in `/admin/component-overrides.js`) lets any number of extensions add custom Lexical nodes and toolbar controls to the page editor's Content editors, instead of replacing the editor as an override does. The nodes go to `k-html-editor`'s `nodes` attribute and the controls to its `toolbar-top-extra` slot. Needs a kempo-ui with URL `nodes` and that slot.
- **Reply-To on email.** `sendEmail` and `sendEmailFromTemplate` take an optional `replyTo` (`name@example.com` or `Name <name@example.com>`; one address on one line, anything else is a 400 before the email is saved). It is kept in a new `replyTo` column of the email log (added to an existing site's table on the next start), shown in **Admin > Emails**, and handed to the `email:send` handler as `email.replyTo` (`null` when there is none), so a retry sends the same header. kempo-resend and kempo-smtp send it as the Reply-To header.
- Admin tabs on Groups, Permissions, Global content, Pages, Templates, Emails and Extensions have a location after their tabs (`admin-groups-tabs`, `admin-permissions-tabs`, `admin-globals-tabs`, `admin-pages-tabs`, `admin-templates-tabs`, `admin-emails-tabs`, `admin-extensions-tabs`), so an extension can add a tab there.
- **Global content page has tabs** for Custom, Extensions and System global content, with hash routing, and each table has a search box that filters by name, location or author.
- **Pages page has tabs** for Custom, Extensions and System pages, with hash routing, and each table has a search box that filters by name, title, URL, description or author on the server. `listPages` takes an optional `q` for the same filter.
- **Templates page has tabs** for Custom, Extensions and System templates, with hash routing, and each table has a search box that filters by name, directory or author.
- **Permissions page has tabs** for Custom, Extensions and System permissions, with hash routing, and each table has a search box that filters by name or description on the server. `getAllPermissions` takes an optional `q` for the same filter.
- **Groups page has tabs** for Custom, Extensions and System groups, with hash routing, and each table has a search box that filters by name or description on the server. `listGroups` takes an optional `q` for the same filter.
- **User search.** The Users page has a search box that filters by name or email on the server, across all pages. `getUsers` takes an optional `q` for the same filter.

- **Marketplace marks.** An extension from the marketplace can be marked official (a green verified icon) or featured (a green workspace-premium icon). The icon sits before the name on the extension browse cards and on its details page.
- **Browse cards have a gap** between them.

### Changed

- **BREAKING: the page builder is replaced by kempo-ui's.** The peer dependency is now `kempo-ui >=1.4.0`. The builder's own code is removed (`src/kempo/sitebuilder/**`, `admin-sitebuilder` and its parts, the frame page, `server/utils/sitebuilder/rebuild.js`), and with it the base classes `Widget`, `WidgetEditor` and `WidgetSettings` of `/kempo/sitebuilder/components/` (use kempo-ui's `ShadowComponent`, `pagebuilder/WidgetEditor` and `pagebuilder/WidgetSettings`), and the widgets kempo had of its own that kempo-ui now provides (Row and Column are Columns and Column; Markup is Text; Hero, Embed, Video player and Social icons are removed with their `/kempo/components/*` elements). An icon setting now holds a kempo-ui icon name or `src:` and the path of an SVG (`src:/commerce/icons/cart.svg`), not the path alone. A page the old builder saved is opened from its file, as one HTML widget per content area.
- **The dashboard widgets key is `admin_dashboard_widgets`.** The old `widgets` key still works as an alias until the next major version.
- Dependencies: `sanitize-html` and `htmlparser2`, used to clean what the builder writes (the Text widget and table cells) and to compare a page file with the builder's copy.
- The admin navigation no longer collapses when Escape is pressed (`esc-close="false"` on its `<k-aside>`), on every admin page. Escape is the page builder's "select the parent" key.
- **No flash of the wrong theme on load.** The admin's `init.js` and the starter's (`app-public/init.js`) set the `theme` attribute from `localStorage` in a blocking script in the `<head>`, before the page paints, as [kempo-ui's theme util documents](https://dustinpoissant.github.io/kempo-ui/utils/theme.html#noFlash), and the templates that load them (the admin's, the starter's default and account templates, and the password reset and email verification pages) have `<meta name="color-scheme" content="light dark">`, so the browser's default background follows the system until the styles arrive. A dark admin used to flash white on every page. A site's own `init.js` and templates need the same two things.
- **kempo-ui 1.3 loads kempo-css from a CDN unless told where it is.** The admin's `init.js` and the starter's (`app-public/init.js`) set `window.kempo.pathToStylesheet` to `/kempo-css/kempo.min.css`, so components use the copy the site serves. A site's own `init.js` needs the same line.


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

### Fixed

- **The password reset and email verification links point at the site that is running.** Their default address was always `http://localhost:3000`, so a site on another port sent links that could not be opened (`ERR_CONNECTION_REFUSED`). A new site now starts with its own `PORT`. A site that already has the setting keeps what it has: change `password_reset_url` and `verification_url` in Settings.
- **An extension's page widgets follow its kempo-config.json without a restart or a version bump.** The page builder read each extension's widgets from the copy stored when it was installed or upgraded, so an edit to `page_widgets` on disk (a new setting, say) did not appear until the version changed. The builder now writes the on-disk declaration to the row when it differs, the next time the widgets are loaded.
- **A page widget can set its own display.** Every extension widget's element got the `d-b` (block) class, which beat a component's own `display` rule, so a widget that changes its display with a setting (the Cart button's Inline) could not. A `display` key in `page_widgets` replaces the class: `""` for none. Documented in `docs/sitebuilder-widgets.md`.

- **Updates page has an update-everything button again.** Its "Update selected" control was hidden, so the only way to update all was to tick every row. It now sits in the table's bottom strip, and a button below the table updates every available item.
- **Installing a downloaded extension** whose requirements were not installed failed with "Requires … to be installed and enabled first". The Install button now shows the same list of extensions to install and enable as installing from the marketplace, and installs them all once approved.

### Requires

- kempo-ui 1.4.0 or later, which has `<k-page-builder>`, the DOM-free `renderPage`, `pageWidgets` and `pageTree` the server uses, and the `saverequest` event, `markSaved()` and `stylesheets` the admin needs to save through the server.

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
