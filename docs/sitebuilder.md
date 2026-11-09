# The Page Builder

Kempo's page editor is [kempo-ui's `<k-page-builder>`](https://dustinpoissant.github.io/kempo-ui/components/page-builder.html), in the way WordPress blocks work: a page is built from **widgets** that are added, configured and nested. Kempo gives the builder what only a CMS has around it, and the page is still saved as a plain HTML file. The admin's side navigation is the only thing left around the builder: it takes the rest of the screen.

Open **Content > Pages**, pick a page, and the builder opens.

## The editor

One control bar runs across the top, from the left:

- the **widget tree** button, which opens the tree of the page's widgets on the left;
- back to the pages, and open the page in a new tab;
- a switcher for the page's content areas, when its template has more than one;
- **Add** (a searchable list of widgets), delete, duplicate, undo, redo, and move up, down, into the widget before and out of its parent;
- phone, tablet and desktop previews;
- the page's own actions, as controls in the bar: the head code, copy, move, replace another page and delete. They are the first controls to move into the bar's own "more" menu when the bar is narrow;
- **Templates** (save the selection as a template, insert one), save, reset, keyboard shortcuts and the **settings** button, which shows or hides the right panel.

The right panel shows the settings of the selected widget, in a Widget tab and a Styles tab. With nothing selected it shows the page's own settings: its **title** and **description**, and (kempo adds these with the builder's `page-settings` slot) its **name** and **template**, with who made it and when. The page is in the middle, in an iframe, so your site's theme shows rather than the admin's.

How selecting, dragging, the keyboard shortcuts and undo work, and what each widget's settings are, is described in [kempo-ui's page builder documentation](https://dustinpoissant.github.io/kempo-ui/components/page-builder.html). What follows is what kempo adds.

### Saving and leaving

Saving (the save button, or Ctrl+S) publishes the page at once: pages are served from their files, so there are no drafts. To work on a draft, **copy** the page, edit the copy (nothing links to it, so only you can find it by its address) and use **Replace another page** on the copy to publish it over the original. The editor asks before a reload or a close while there are unsaved changes.

Saving checks that the file is still the one the editor opened, so two people cannot silently overwrite each other. If the file changed, the save is refused and you are offered a reload.

### Content areas

A page's template decides which **content areas** it has (`<location />` in the template: the default one, and any others, such as a sidebar). The builder edits one area at a time and the switcher in the control bar (kempo adds it to the bar, with the page's areas from the server) changes which. The area is in the address hash (`/admin/content/pages/edit?path=about#scripts`; the first area has no hash), so a link, a reload and the back button keep it. The undo history belongs to the area shown, so it starts again when you switch. **Scripts** is a content area like the others, where Script widgets belong. Only the **head** is code: it opens from the **Head code** control in a code editor and is kept as it is.

### Templates

**Save as template** saves the selected widgets (with everything inside them) under a name; **insert template** places a copy of one. Templates are stored in the database (`sitebuilderTemplate`) and shared by everyone who edits pages. A template is a pattern: changing it later does not change the pages that used it. Content that should be changed in one place and shared by many pages is a **Fragment** (see Server widgets).

## Widgets

### The ones kempo-ui provides

Text, Markdown, Image, Video, Audio, File, Photo viewer, Media gallery, Hero, Embed, Group, Fullscreen breakout, Container, Columns (and Column), Spacer, Divider, Button, Table, HTML, Script, Accordion, Tabs, Card, Content slider, Show more and Icon. See kempo-ui's documentation for each one's settings.

Two things are different on a kempo site:

- **HTML** writes what was typed in it exactly as it is, with **no element around it** (kempo-ui draws a `div`). That is what lets a page the builder did not write open as HTML widgets and be written back unchanged. It has no box, colours or classes of its own: put it in a Group to give it those. Scripts and styles in it run on the published page. Only trust people who may edit pages with it, since it is not sanitized.
- **Icons** are chosen with the site's own icon picker, which offers every icon the site has (its own, kempo's, kempo-ui's and each extension's). An icon setting holds a kempo-ui icon name (`add`) or `src:` and the address of an SVG file (`src:/commerce/icons/shopping_cart.svg`). **Image**, **Video** and **Audio** settings have a button that opens the media library.

### Account widgets

The functions of kempo itself are widgets, so the pages that come with kempo (login, register, forgot password, reset password, account, delete account) are made of them and can be changed in the page builder, and the same pieces can go on any page. They are in the **Account** group:

- **Login form** and **Register form** (`k-login`, `k-register`): what is placed inside shows under the form (another way in). Each has settings for where to go afterwards.
- **Forgot password form**, **Reset password form** (for the page at `/reset-password/<token>`), **Delete account form** (a code is sent to the account's email before anything is deleted).
- **Change password button** (opens the form in a dialog) and **Logout button** (text, where to go afterwards, color): plain kempo-css `<button class="btn">` elements with nothing around them, made to work by one script per page (`LogoutButton.js`, `ChangePasswordButton.js`). The Styles tab's margin, alignment and color classes go on the button itself, so they line up with any other button. A button with a margin only below it (`mb`) sits higher on the line than one with none, so give every button in a row the same margin classes, including the links other extensions add: the account page and the links its extensions add all use `mb mrq`. In the builder they are links that do nothing.
- **Signed-in name**, **email**, **email verified** and **member since**: the signed-in person's details, drawn inline.
- **Notification bell** and **Notification list**.
- **Show for permission** (in the **Server** group) shows what is inside it only to people who have a permission. It draws no box of its own (`display: contents`).

In the builder these draw as they do on the page, but they never sign anyone in or out or send a form, so working on a page never changes the session of whoever is editing it, and what is inside Show for permission is always shown there.

### The pages that come with kempo

Kempo's own pages (the home page, 404, login, register, forgot and reset password, verify email, delete account and account) are made of widgets, so a new site opens them in the page builder as widgets, ready to change, and not as one block of code. A page the builder did not write has no stored layout, so each of these has its widgets in `src/kempo/pagebuilder/systemPages.js`, and the page file in `app-public/` is what they render to. The first time the builder opens one of these pages, if the file still holds exactly what its widgets render to, it opens as those widgets. A page that has been changed by hand no longer matches, so it is taken as it is (one HTML widget) and is never replaced.

To change one of these pages in kempo itself, change its widgets in `systemPages.js` and run `npm run build:pages`, which writes the files in `app-public/`; a test fails if a file and its widgets disagree. The setup page, the navigation and footer fragments and the page templates are not made of widgets.

### Server widgets

A server widget writes one of the server's own template tags, which the server resolves on every request, so the page is still a plain file. They are in the **Server** group.

- **Fragment** places a fragment (`<fragment name="nav" />`): a disclaimer or notice used on many pages and edited in one place. Its settings are a list of the site's fragments, with a link to edit the chosen one.
- **Location** is a place other extensions fill (`<location name="…" />`).
- **Conditional** (`<if condition="name">`) shows its content only when a value is set; put `!` in front to invert it.
- **Repeat** (`<foreach in="list" as="item">`) repeats its content for each item of a list.

Conditional and Repeat can use the values the server has for a page: the attributes on its `<page>` tag, the built-ins (`year`, `date`, `datetime`, `timestamp`) and the site's globals, and their settings suggest the page's own as you type. In the editor a server widget is a labelled box, because nothing resolves it there. `{{ }}` can be typed in any text and is kept as typed; the tags themselves only come from server widgets. They have no styles or classes, since the server replaces them.

### Widgets from extensions

An enabled extension adds its widgets to the same Add list, in a group of its own (Forms, Products, Blog). Turning an extension off takes its widgets out of the list. A page that uses one keeps it in the builder's copy and leaves it off the published page until the extension is on again. [Building page builder widgets](sitebuilder-widgets.md) is the guide for writing them.

## How a page is stored

The page file is what is served, and it is plain HTML: no render happens per request. The builder keeps the widget tree (JSON, one list per content area) in its own database table (`sitebuilderPage`), keyed by the page's file path, with the hash of the file it last wrote. **The tree is what the builder edits; the file is generated from it on every save** (each widget writes its HTML, and the module scripts the widgets on the page need are added once at the end).

When a page is opened, the file's hash is compared with the stored one.

- **They match:** the page opens from the tree.
- **There is no row** (the page was written by hand, deployed without it, or saved by an earlier kempo): the page file is taken as it is. The content of each content area becomes **one HTML widget**, written back exactly as it is, so nothing is changed or lost, and everything can be edited. Split it into real widgets as you go.
- **They differ** (the file was changed outside the builder): the tree stored and the file are compared by meaning (whitespace, attribute order and quote style do not matter). If they say the same thing, nothing happens. If they differ, someone who can edit the page gets a dialog with a preview of each version and chooses which to keep. Choosing saves both sides: the file is taken as it is (as HTML widgets), or the tree is rendered over the file.

A page that holds something **outside its content blocks** (the part of the file that is not frontmatter, the `<page>` tag or a `<content>` block) cannot be kept that way, and is edited as code instead. Going from code back to the builder replaces the page's content: you choose to start over with an empty page, or to start from the last page the builder had.

Copying, moving, disabling, enabling and deleting a page take the builder's row with them. **Replace another page** moves a page over another page after a confirmation.

### What the server accepts

Everything the editor sends is checked again by the server, because anyone can send it a request without ever loading the editor. Only widgets the site has, only the settings each declares (each cleaned by its type), well-formed unique ids and at most 5000 widgets are kept. Rich text is sanitized. See `server/utils/sitebuilder/validateTree.js`.

## For developers

- Server code is in `server/utils/sitebuilder/`: opening, saving, resolving a conflict, leaving code mode, rendering (`pageCore.js`, which uses kempo-ui's DOM-free `renderPage`), validating (`validateTree.js`), the widget registry (`registry.js`) and templates.
- The widgets only kempo has (the server widgets, the account widgets in `coreWidgets.js`, and the HTML widget written as it is) are in `src/kempo/pagebuilder/`, which imports nothing, so the server and the admin register the same ones. The builder's copies of the account widgets are in `src/admin/components/pagebuilder/CoreWidgetEditors.js`.
- The admin component is `src/admin/components/pagebuilder/PageBuilderEditor.js` (`<admin-page-builder>`), around `<k-page-builder>`. The controls it adds to the bar are kempo-ui controls in `controls/`: `PageControl.js` (`<admin-pb-control>`, a `ButtonControl` for the links and the page's actions) and `LocationControl.js` (`<admin-pb-location>`, a `Control` that chooses the content area). The page's name and template are fields in the builder's page settings panel (`slot="page-settings"`). The builder ranks a spot of extra controls by their `priority`, so the links and the area chooser have one and the page's actions have `-1`, which moves them into the "more" menu first; `PageEditor.js` loads the page, saves it and shows the conflict and code screens.
- Routes are under `/kempo/api/sitebuilder/`, and `/kempo/sdk.js` exposes them (`openSitebuilderPage`, `saveSitebuilderPage`, `resolveSitebuilderConflict`, `leaveSitebuilderCodeMode`, the template functions). Page management has `copyPage` and `movePage({ overwrite: true })`.
- A site's own `init.js` needs `window.kempo.pathToStylesheet = '/kempo-css/kempo.min.css'` (kempo-ui 1.3 loads kempo-css from a CDN otherwise). The builder draws the page in a frame that copies the admin page's stylesheets, so the admin hands it the site's `/styles.css` too (`stylesheets` on `<k-page-builder>`). Saving goes through the server, so the admin listens to the builder's `saverequest` event, stores the page, shows a `Toast.success` or `Toast.error`, and calls `markSaved()` once the page is stored.
