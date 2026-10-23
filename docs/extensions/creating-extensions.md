# Creating Extensions

Extensions are standard npm packages with a `kempo-config.json` file at their root. Kempo reads this config to automatically handle database tables, permissions, settings, groups, event hooks and dashboard widgets when the extension is installed, updated, or uninstalled. Nothing kempo reads goes in `package.json`.

## Minimal Extension

The minimum required for a kempo extension is an ordinary `package.json` and a `kempo-config.json`:

```json
// package.json
{
  "name": "my-extension",
  "version": "1.0.0"
}
```

```json
// kempo-config.json
{}
```

That's a valid (though empty) extension. Anything you declare in `kempo-config.json` is handled automatically by kempo core.

## Package Structure

```
my-extension/
├── package.json          # Required — an ordinary npm package.json, with no kempo field
├── kempo-config.json     # Required — declares everything kempo reads (see below)
├── install.js            # Optional — custom install logic
├── update.js             # Optional — custom migration logic
├── uninstall.js          # Optional — custom uninstall logic
├── server/
│   └── db/
│       └── schema.js     # Database tables (if `schema` is set in kempo-config.json)
├── hooks/
│   └── *.js              # Event hook handlers
├── admin/
│   ├── index.page.html   # Admin page
│   ├── *.global.html     # Content pushed into admin page slots
│   └── *.fragment.html   # Fragments offered to admin pages
└── public/
    ├── ...               # Public-facing pages and assets
    ├── *.global.html     # Content pushed into site page slots
    ├── *.fragment.html   # Fragments offered to site pages
    └── *.menu-item.html  # Items an admin can add to the site's menus
```

## The `kempo-config.json` File

All extension capabilities are declared in `kempo-config.json`. Older extensions put the same object in a `kempo` field of `package.json`; kempo still reads that as a fallback, field by field with `kempo-config.json` winning, but new extensions should not use it.

```json
{
  "git": "https://github.com/yourname/my-extension",
  "public-scope": "my-ext",
  "schema": "./server/db/schema.js",
  "hooks": {
    "page-created": "hooks/page-created.js"
  },
  "permissions": [
    { "name": "my-ext:posts:create", "description": "Create posts" },
    { "name": "my-ext:posts:delete", "description": "Delete posts" }
  ],
  "settings": [
    { "name": "posts_per_page", "value": "10", "type": "number", "description": "Posts shown per page" }
  ],
  "groups": [
    {
      "name": "my-ext:Authors",
      "description": "Users who can create posts",
      "permissions": ["my-ext:posts:create"]
    }
  ]
}
```

### Config Fields

| Field | Purpose |
|---|---|
| `git` | GitHub URL used to detect available updates |
| `public-scope` | URL prefix for the extension's `public/` directory |
| `public-scopes` | More URL prefixes, each serving its own folder: `{ "categories": "public-categories" }`. See *Public Routes* |
| `schema` | Path to a Drizzle schema file |
| `permissions` | Permissions to create on install |
| `settings` | Settings to create on install |
| `groups` | Groups to create on install, with their assigned permissions |
| `hooks` | Event hooks to register (`{ "event-name": "path/to/handler.js" }`) |
| `widgets` | Widgets to add to the admin dashboard, see [Admin Dashboard](../dashboard.md) |
| `jobs` | Recurring work kempo runs for you, see [Scheduled Jobs](#scheduled-jobs) |
| `aliases` | Short addresses for your public pages, see [Address Aliases](#address-aliases) |
| `dependencies` | Names of other extensions that must be installed and enabled first |

## Database Tables

Create a Drizzle schema file and point `schema` in `kempo-config.json` at it:

```javascript
// server/db/schema.js
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const post = pgTable('post', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: text('authorId').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});
```

Kempo generates `CREATE TABLE IF NOT EXISTS` from your Drizzle table definitions on install and `DROP TABLE IF EXISTS` on uninstall. **Name all tables with your extension prefix** to avoid conflicts with other extensions (e.g. `blogPost`, not `post`).

### Column Migrations

Kempo only creates and drops whole tables. If you need to add a column in a new version, do it in `update.js`:

```javascript
// update.js
import db from 'kempo/server/db/index.js';
import { sql } from 'drizzle-orm';

export default async ({ oldVersion, newVersion, oldKempo, newKempo }) => {
  // Add a column that was added in v1.2.0
  if(semverLt(oldVersion, '1.2.0')){
    await db.execute(sql`ALTER TABLE "myExtPost" ADD COLUMN IF NOT EXISTS "slug" text`);
  }
};
```

## Permissions

Declare permissions in `kempo.permissions`. Use your extension name as the prefix to avoid conflicts:

```json
"permissions": [
  { "name": "my-ext:posts:create", "description": "Create posts" },
  { "name": "my-ext:posts:own:delete", "description": "Delete own posts" },
  { "name": "my-ext:posts:any:delete", "description": "Delete any post" }
]
```

Convention: `extensionName:resource:scope:action` — the scope (`own`, `any`, `others`) is optional but useful for fine-grained control.

### Checking Permissions in Your Route Handlers

```javascript
import currentUserHasPermission from 'kempo/server/utils/permissions/currentUserHasPermission.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [err, allowed] = await currentUserHasPermission(token, 'my-ext:posts:create');
  if(err || !allowed) return response.status(403).json({ error: 'Forbidden' });
  // ...
};
```

## Settings

Declare settings in `kempo.settings`. They are stored as `extensionName:settingName` in the database:

```json
"settings": [
  { "name": "posts_per_page", "value": "10", "type": "number", "description": "Posts per page" },
  { "name": "allow_comments", "value": "true", "type": "boolean", "description": "Enable comments" }
]
```

`value` is written as a string whatever the type — kempo converts it on the way in. A `json` setting
may be written either way, as a string holding JSON or as the real array or object:

```json
"settings": [
  { "name": "sizes", "value": "[{\"label\":\"sm\",\"width\":320}]", "type": "json", "description": "Thumbnail sizes" },
  { "name": "sizes", "value": [{ "label": "sm", "width": 320 }], "type": "json", "description": "Thumbnail sizes" }
]
```

Both store the same thing, and `getSetting` hands back the array either way.

Read them at runtime:

```javascript
import getSetting from 'kempo/server/utils/settings/getSetting.js';

const [, perPage] = await getSetting('my-ext', 'posts_per_page', 10);
const [, commentsEnabled] = await getSetting('my-ext', 'allow_comments', true);
const [, sizes] = await getSetting('my-ext', 'sizes', []);   // a real array, not JSON text
```

Values come back converted to the setting's declared type, so a `json` setting is an array or object
rather than a string you have to parse.

An extension's settings are not listed on `/admin/settings` by themselves: the extension either adds a tab there (below) or manages its own settings on a screen of its own. Either way each setting is edited with the editor for its type, under a readable name made from its name, so site admins can change them without a code deploy. Write a `description`: it is shown under the name.

### Settings tabs

An extension that wants its settings on a tab of their own adds a `k-settings-tab` to the Settings page by filling its `admin-settings-tabs` location (an `*.global.html` file in the extension, like any global content), and loads what the tab uses from `admin-settings-scripts`:

```html
<content id="my-extension-settings-script" name="My Extension settings script" owner="my-extension" enabled="true" locked="true" location="admin-settings-scripts" priority="10"><script type="module" src="/admin/components/settings/SettingsPanel.js"></script></content>
<content id="my-extension-settings-tab" name="My Extension settings tab" owner="my-extension" enabled="true" locked="true" location="admin-settings-tabs" priority="10">
  <k-settings-tab name="my-extension" label="My Extension" position="500">
    <k-settings-panel owner="my-extension"></k-settings-panel>
  </k-settings-tab>
</content>
```

`position` orders the tabs (Custom is 100, System 200, 500 when left out). The tab holds anything. `<k-settings-panel owner="...">` lists all of the extension's settings with their editors and a Save button, and needs no code. To edit only some settings, or mix them with your own controls, use the editors directly:

```html
<k-setting .setting=${{ name: 'cache_minutes', value: 60, type: 'number', description: 'How long a price is kept' }}></k-setting>
```

`k-setting` picks the editor for the type and fires a bubbling `setting-change` event with `{ name, value, valid }`; the single-type editors (`k-setting-string`, `-number`, `-boolean`, `-json`, `-secret`) are served from `/admin/components/settings/`. Saving is yours to do with `setSetting` from `/kempo/sdk.js`.

### Secret Settings

Use `type: "secret"` for anything you wouldn't want visible in the admin panel or an API response —
a payment provider's API key, a webhook signing secret, an OAuth client secret:

```json
"settings": [
  { "name": "stripe_secret_key", "value": "", "type": "secret", "description": "Stripe API secret key" }
]
```

A `secret` setting is encrypted at rest (`SETTINGS_ENCRYPTION_KEY` must be set — see `.env.example`),
is always excluded from `getPublicSettings`/`isPublic` regardless of what you pass, and the admin
panel only ever shows `••••••••` for one that has a value — editing it is replace-only, never a reveal.

`getSetting`/`getSettingsByOwner` still hand back the real decrypted value for your own server-side
code to use (e.g. to call the provider's API):

```javascript
const [, stripeKey] = await getSetting('my-ext', 'stripe_secret_key');
```

Never route a `secret` value back to the browser yourself — that's the one thing this type exists to prevent.

## Groups

Declare groups with their default permissions in `kempo.groups`:

```json
"groups": [
  {
    "name": "my-ext:Authors",
    "description": "Can create and manage their own posts",
    "permissions": ["my-ext:posts:create", "my-ext:posts:own:delete"]
  }
]
```

Site admins assign users to these groups through the admin panel.

## Hooks

Hooks let your extension react to events in the CMS. Declare them in `hooks` in `kempo-config.json`:

```json
"hooks": {
  "page-created": "hooks/page-created.js",
  "extension:installed": "hooks/on-installed.js"
}
```

Each handler is a file with a default export:

```javascript
// hooks/page-created.js
export default async (data) => {
  const { page } = data;
  // Do something when a page is created
};
```

Errors in hook handlers are caught and logged — they do not interrupt the triggering operation.

Handlers are **awaited one at a time, in registration order**. That means slow work in a handler delays whatever triggered the event: if your handler needs to do something expensive (call an external API, run a model), start the work and return rather than awaiting it here.

### Built-in Events

| Event | Data | When |
|---|---|---|
| `extension:installed` | `{ name, version }` | After any extension is installed |
| `extension:uninstalled` | `{ name }` | After any extension is uninstalled |
| `extension:updated` | `{ name, oldVersion, newVersion }` | After any extension is updated |
| `page-created` | `{ page }` | After a page is created |
| `notification:created` | `{ notification, recipientIds, refreshed }` | A notification reached at least one person |
| `route:unmatched` | `{ url, method, request, draft }` | A request matched no file, page or route anywhere on the site |
| `user:email_verified` | `{ userId, email }` | Someone followed their verification link, so they have proved they own the address |
| `email:send` | `{ email: { id, to, from, subject, html, type, attempt } }` | An email is waiting to be sent: an email extension sends it and answers, see [Writing an Email Extension](#writing-an-email-extension) |

### Answering a Request Nothing Else Claimed

`route:unmatched` is how an extension serves something that has no file behind it — a download gated behind a permission check, a short link, a generated feed. It fires for any unmatched URL on the site, at any depth, with no prefix or configuration involved.

Handlers never touch the response directly. Instead they fill in `data.draft`, and kempo performs a single write once every handler has run:

```javascript
// hooks/route-unmatched.js
export default async ({ url, request, draft }) => {
  const file = await lookUpByPath(url);
  if(!file) return;                         // not ours — leave the draft untouched

  draft.headers['Content-Type'] = 'text/plain';
  draft.filePath = file.absolutePath;        // streamed with Range support
  draft.handled = true;
};
```

| Field | Effect |
|---|---|
| `filePath` | Streamed through kempo-server, so `Range`/`206` works and large media still seeks. Takes precedence over `body`. |
| `body` | Sent as-is with `status` (default `200`). |
| `status` | Response status. Defaults to `200` with a body, `204` when only `handled` is set. |
| `headers` | Merged into the response — including onto the default 404, so you can annotate a response you did not claim. |
| `handled` | Whether an earlier handler already answered. Set it when you claim the request. |

Because nothing is sent until every handler has run, claiming a request never silences the handlers after you — an extension that logs 404s still sees requests you answered, and a later handler can add to a response already in progress. Check `draft.handled` if you want to defer to whoever got there first. If no handler claims the request, the site's `CATCH.page.html` renders as a normal 404.

## Scheduled Jobs

Declare recurring work in `kempo-config.json` and kempo runs it for you, with no cron and no timer of your own:

```json
{
  "jobs": [
    { "name": "expire-orders", "every": "1m", "callback": "./jobs/expire-orders.js" }
  ]
}
```

`every` is a number of milliseconds or a string such as `"30s"`, `"15m"` or `"6h"` (at least a second). The callback is relative to your package and its default export is called with `{ owner, name }`:

```javascript
export default async ({ owner, name }) => {
  await expireStaleOrders();
};
```

- A new job is due straight away, then every interval after that. The server checks every 15 seconds, so an interval is the least time between runs, not an exact one.
- A job that throws is logged and recorded (`lastStatus`, `lastError`) and is tried again next interval; it never stops other jobs.
- **Several server processes sharing one database run each job once per interval.** A job holds a lease on its row while it runs; a process that dies mid-run loses the lease after five minutes. Still write jobs so that running twice is harmless.
- A disabled extension's jobs stay registered but do not run, the same as its hooks. Uninstalling removes them. Updating makes the schedule match what the new version declares.
- Needs the `scheduledJob` table (`npx drizzle-kit push` on an existing site). Without it a job is reported as not registered and your extension otherwise works.
- Set `KEMPO_SCHEDULER=off` in a process's environment to keep that process from running jobs.

From code: `listJobs`, `runJob({ owner, name })` (run one now) and `runDueJobs` are in the [Server SDK](sdk.md#scheduled-jobs).

## Address Aliases

An extension's public pages live under its `public-scope` (`/commerce/cart/`). To answer on a shorter address as well, declare `aliases`:

```json
{
  "public-scope": "commerce",
  "aliases": { "/cart": "/commerce/cart", "/checkout": "/commerce/checkout" }
}
```

`/cart`, `/cart/` and anything under it are then served from `/commerce/cart`; the address in the browser stays `/cart/`, so use absolute links inside the page. An alias must point inside one of your own scopes, cannot be under `/admin` or `/api`, and **never replaces a page the site has of its own at that address**: a site that already has `public/cart/` keeps it. An invalid alias is refused when the extension is installed.

## Writing an Email Extension

Kempo logs every email and leaves sending to an extension, so a provider (Resend, SMTP, a mail API of your own) is one hook handler. Register `email:send` and answer with whether you sent it:

```json
{ "hooks": { "email:send": "./hooks/send.js" } }
```

```javascript
// hooks/send.js
export default async ({ email }) => {
  // email: { id, to, from, fromIsDefault, subject, html, type, attempt }
  const response = await fetch('https://mail.example.com/send', { method: 'POST', body: JSON.stringify({ from: email.from, to: email.to, subject: email.subject, html: email.html }) });
  if(!response.ok) return { sent: false, error: `The mail service answered ${response.status}` };
  return { sent: true, provider: 'my-mail-service', messageId: (await response.json()).id };
};
```

- **Say when you are not set up.** With no key or host saved, return `{ sent: false, skipped: true, error: 'No key is saved' }`: kempo does not count that as a try, and only shows the reason when no extension got as far as trying, so a failure of the one that is set up is not buried under it.
- **`email.fromIsDefault`** is true when the site has not set its own sender, so `email.from` is only the placeholder `noreply@example.com`. A sender that knows a better one (an SMTP extension's mailbox) should use that instead.
- **Return `{ sent: true }` only when it really went.** The first handler to do so ends the chain, so with several email extensions installed only one sends. A handler that returns `{ sent: false, error }` (or throws) leaves the email for the next handler, and for a retry later (the `email_max_retries` setting); the error is shown in **Admin > Emails**.
- **Never touch the log.** Kempo records the status, the attempts, `provider` and `messageId`.
- **Do not send what you did not get.** Handlers run in the order they were registered; the email is yours to send once, not to inspect and pass on. A "log only" extension should return `{ sent: false }` and let a real sender run after it, but kempo already logs everything.
- **Settings.** Keep credentials (an API key, a password) in `secret` settings and put a tab on the admin Settings screen for them (see [Settings tabs](#settings-tabs)). `from` is already the address the site sends from; do not read your own copy.

## Email Templates

Send your extension's emails with `sendEmailFromTemplate` and a template name of `your-extension/name`. The page lives in your package at `emails/name.page.html`, uses `<page template="email">`, and is laid out with the site's `templates/emails/email.template.html` when it has one and kempo's otherwise, so every email a site sends looks alike. A site can reword yours by adding `templates/emails/your-extension/name.page.html`.

Style a template with kempo-css classes and no inline styles: kempo runs it through `kempo-css/shake`, which embeds only the rules it uses.

**Let the site edit them.** Put the editor on your extension's settings page, with a tab if the page has them. It lists your templates, opens one in a code editor in a dialog, saves the site's copy to `templates/emails/your-extension/` (so an update of your extension does not undo it), and offers **Reset to default**:

```html
<script type="module" src="/admin/components/EmailTemplates.js"></script>
<k-email-templates owner="your-extension"></k-email-templates>
```

Each row has a **Preview** that opens the saved template in one named tab. By default that is kempo's preview, which draws it with no data; to preview with your own data (an order, a user), serve a route that renders the template and give its address as `preview-url`.

It needs the `system:pages:read` permission to list and read and `system:pages:update` to save. A template that does not render is not saved. Without `owner` it lists kempo's own templates. The same actions are in the client SDK (`listEmailTemplates`, `getEmailTemplate`, `saveEmailTemplate`, `resetEmailTemplate` in `/kempo/sdk.js`) and under `/kempo/api/email-templates`.

## Dependencies

If your extension requires another extension to be installed and enabled first, declare it in `kempo.dependencies`:

```json
"dependencies": ["kempo-files"]
```

Install and enable both fail with a 409 while a declared dependency isn't installed and enabled. In the other direction, disable and uninstall fail with a 409 while another enabled extension still declares a dependency on yours — so a dependency can't be pulled out from under something that needs it. Version constraints aren't checked, only presence and enabled state; use `install.js` for anything more specific.

## Public Routes

Set `public-scope` in `kempo-config.json` to a URL prefix. Files in your `public/` directory are served under that prefix:

```json
"public-scope": "blog"
```

With this, `public/index.page.html` is served at `/blog/`, `public/posts.page.html` at `/blog/posts`, etc.

The kempo middleware serves these, and your `public/` directory gets the same capabilities the
site's own does: static files, dynamic route handlers (`GET.js`, `POST.js`, `[param]/` directories,
`CATCH.js`), and server-side templated `.page.html` pages with fragments and global content.

### More than one scope

An extension can answer on several top-level addresses, each serving its own folder of the package. `public-scope`
is the shorthand for the first, serving `public/`; `public-scopes` adds the rest as `scope: folder`:

```json
{
  "public-scope": "products",
  "public-scopes": { "categories": "public-categories" }
}
```

With this, `public/index.page.html` is `/products/` and `public-categories/index.page.html` is `/categories/`.
Each folder gets everything described above. Add every folder to your package's `files`, or an installed copy
will not have it. Folders other than `public/` are for pages and routes: fragments, global content and menu
items are still read from `public/`.

A scope is lowercase letters, numbers, dashes and underscores (`products`, not `Products` or `a/b`). A folder
must be inside the package (no `..`, not absolute). `admin`, `api`, `kempo`, `kempo-css`, `kempo-ui` and
`monaco-editor` belong to kempo itself and cannot be used. An invalid declaration is refused when the extension is
installed.

### An address belongs to one extension

Every scope, and every alias address, is a **claim**, and the router can give an address to only one extension.
Two enabled extensions may not claim the same address, or one inside the other (`/shop` and `/shop/cart`
collide; `/products` and `/products-inventory` do not). Without that, the router would hand every request to
whichever it reached first, and the other extension's pages, scripts and API routes would answer 404 with no error
anywhere, and which one won could change when any extension was enabled, disabled or updated.

So kempo checks, and refuses with the reason:

- **Installing** an extension that claims an address another enabled extension has: *Cannot install kempo-b:
  kempo-a already uses /shop. Disable or uninstall kempo-a first.*
- **Enabling** one the same way. An extension that was switched off while another took its address stays off.
- **Updating** to a version that newly claims an address in use. The update is refused and the previous version is put
  back.

Nothing is changed when a check refuses. Disable (or uninstall) the extension that holds the address, then install or
enable the other. A page the **site** has of its own at an alias address still wins over the alias, as before.

So pick scopes that say what the extension is (`my-ext-shop`, not `shop`) and treat a short alias like `/cart` as
something only one extension on a site can have.

## Contributing Content to Pages You Don't Own

Your extension ships its own pages — but it can also add content to pages it does not own: the
site's own pages, and other extensions' pages. There are two ways, and which one you want depends
on whether the target page knows you exist.

Both work by dropping a file into your package. Nothing is written anywhere on install, so there is
nothing to clean up on uninstall, and enabling, disabling or upgrading your extension takes effect
immediately. Put the file in `public/` to contribute to the live site, or `admin/` to contribute to
the admin portal.

### Push: `*.global.html`

The target page exposes a named slot and does not know or care who fills it. Any number of
extensions can contribute to the same slot; everything is merged and ordered by `priority`.

```html
<!-- public/promo-banner.global.html -->
<content location="site-banner" priority="10">
  <aside>Free shipping this week</aside>
</content>
```

That lands in any page whose template has `<location name="site-banner" />`. This is the same
mechanism `admin/nav.global.html` has always used to add an admin nav entry.

#### Grouping admin nav entries

An extension's nav entry is a `<k-aside-item>` pushed into the `admin-nav-extensions` location. Give it a
`group` and the admin menu groups it with others that name the same group:

```html
<!-- admin/nav.global.html -->
<content id="my-extension-nav" name="Products" owner="my-extension" enabled="true" locked="true" location="admin-nav-extensions" priority="15">
<k-aside-item icon="label" group="Commerce" href="/admin/extension/my-extension/" no-expand>Products</k-aside-item>
</content>
```

A group used by only one entry stays a normal link. When two or more extensions use the same group,
the admin wraps them in a menu with that name, and takes the menu away again if one is disabled. The
menu icon comes from the admin's own map (`Accounts`, `Content`, `Settings` and `Commerce` have one), otherwise from the first
`group-icon="..."` attribute among the entries, otherwise a folder. Entries without a `group` are
unaffected. This is `k-aside`'s item grouping, documented in kempo-ui.

Kempo's own admin links use the same mechanism, so there is no separate "core" and "extension" section: an
extension can join a core group by naming it. The core groups are **Accounts** (Users, Groups,
Permissions), **Content** (Templates, Pages, Fragments, Global Content) and **Settings** (Admin Settings,
Extensions). Put an entry in whichever group fits (`group="Settings"` for a configuration screen), or
invent a group of your own.

### Pull: `*.fragment.html`

The page explicitly asks for something by name, and you supply it. Exactly one fragment can win —
a `<fragment>` tag inserts one thing, not a merged list.

```html
<!-- public/payment-badge.fragment.html -->
<fragment>
  <span class="badge">Secure checkout</span>
</fragment>
```

A page (in any package) that contains `<fragment name="payment-badge" />` renders it. If nobody
supplies it, the tag's inline fallback content renders instead — so a page can ask for something
optional without requiring the extension that provides it.

### Overriding a fragment someone else ships

Because only one fragment can win, same-named files compete on `priority`, declared on the
`<fragment>` wrapper (default `0`):

```html
<!-- public/add-to-cart.fragment.html — replaces the default -->
<fragment priority="10">
  <button>Notify me when back in stock</button>
</fragment>
```

Resolution: the site's own directory walk-up yields at most one candidate (unchanged — a page's
nearest fragment still shadows a more general one), each enabled extension contributes at most one
more, and the **highest priority wins**. A tie keeps the site's own file, so overriding something a
site already has is always deliberate rather than an accident of install order. Extensions compete
on priority alone, never on directory proximity.

This is how one extension deliberately replaces another's markup — a commerce extension's default
"add to cart" block swapped for one that handles out-of-stock items — with the extension being
overridden knowing nothing about it.

### Menu items: `*.menu-item.html`

Do not place your own link or button in the site's navigation with a script. Offer it as a **menu
item** and the admin adds it on **Admin → Content → Menus**, where **Add item** has a first choice of
*A link* or one of the items extensions offer. It is then placed, ordered, hidden and deleted like any
other item of that menu, and it leaves the site when your extension is disabled or removed.

```html
<!-- public/cart.menu-item.html -->
<menu-item id="cart" label="Cart" description="The shopping cart button, with the number of items in it." icon-src="/shop/icons/cart.svg">
  <k-shop-cart-button></k-shop-cart-button>
  <script type="module" src="/shop/components/CartButton.js"></script>
</menu-item>
```

- `id` and `label` are required; `description` (one line, shown when the item is chosen), `icon` (the name of an icon in kempo's shared set) and `icon-src` (the path to an icon file your extension ships, which wins over `icon`) are optional. The item is named `<your package name>:<id>`. A file without a `<menu-item>` wrapper, or without both, is skipped.
- The wrapper's content is what is rendered where the admin puts the item. It is plain markup, so if it uses a custom element, include the `<script>` that defines it (a module that is loaded twice runs once).
- One file per item, anywhere under `public/`.
- The admin's menu holds a copy of your markup, refreshed when extensions are installed, enabled, disabled or removed. Changing the file in an update reaches menus on the next such change or the next time that menu is edited.
- It can only be used in a menu the site's theme has (a `<location menu="true" />`). A site with no menu can still place your element itself, so document it.

## Designing for Other Extensions: Slots, Templates and Locations

Extensions add to each other. The pattern that scales is **composition**: the owner of a page or a
component says exactly where others may add things, and everyone else adds only there. Nobody reaches
into anybody's DOM from JavaScript. This is the pattern kempo-products uses for its product cards and
product page, and kempo-commerce uses to add "Add to cart" to them without either one editing the
other.

### The rules

1. **Slots, not injection.** A component declares where outside content may go with named `<slot>`s.
   The content is that component's ordinary (light DOM) children, placed there by whoever uses it. Do not
   `append`, `innerHTML` or `createElement` your content into someone else's component, do not reach
   into its shadow root, and do not append to your own component's DOM from its own script. Lit owns
   what a component renders: the next render removes what was added by hand, and nothing says where
   things may go, so two extensions end up fighting over the same spot.

2. **Composition over inheritance.** Build bigger things by placing components inside components. Extend
   a class only to make a *variation* of that component (a card that lays itself out differently). A new
   feature is another component placed in a slot, not a subclass.

3. **A repeated thing uses one `<template>`.** When every item in a list needs the same added content (a
   button on each product card), the page carries **one** `<template>`, and the component that repeats
   the items clones its content into each item as slotted children. The item never knows about
   templates:

   ```javascript
   // in the list, which repeats the cards
   html`<k-products-card .product=${product}>${document.importNode(template.content, true)}</k-products-card>`
   ```

   Make the clone once per item and keep it (a `WeakMap` keyed by the item), or the next render builds
   a fresh one and the components inside lose their state.

4. **Find your context with `closest()`.** A component placed in someone else's slot finds the exact
   parent it is inside of, and reads that parent's public contract:

   ```javascript
   const card = this.closest('k-products-card');
   card.getAttribute('product-id');   // which product this instance is for
   card.product;                      // what the parent already loaded: do not fetch it again
   ```

   A parent's contract is an attribute that names what it is for, properties for data it already has,
   methods that cause actions, and bubbling, composed events that say something happened. This works
   because slotted children are light DOM descendants. It does **not** work for content injected into a
   shadow root (`closest()` stops at the root), which is one more reason to use slots. Do not be afraid
   to call `closest()`: it is what makes a card with ten different extensions' components in it work,
   with each one knowing exactly which card it is in.

5. **Locations are the insertion points.** A page, template or fragment declares a place with
   `<location name="…" />`, and any extension fills it with a `*.global.html` file (see *Push* above).
   When the place is a component's slot, put the location **directly among the component's children**,
   with no wrapper. The element an extension contributes names the slot it fills itself, with
   `slot="…"`, like any child of a web component:

   ```html
   <k-products-detail>
     <location name="products-detail-price" />
     <location name="products-detail-actions" />
     <location name="products-detail-extra" />
   </k-products-detail>
   ```

   A slot takes any number of elements, so a wrapper `<div slot="actions">` adds nothing: it is one more
   thing to style, and, because it would always be assigned to the slot, it would hide the slot's default
   content (rule 8) even when nobody contributed.

6. **Ship the script with the contribution.** Your contribution is the custom element plus the
   `<script type="module">` that defines it, and the script goes in a *scripts* location **outside** any
   `<template>`, so it loads once, and only on the pages that have the location. The element upgrades
   when the module defines it. All the behaviour (fetching, rendering) belongs in that component, not in
   a script that goes looking for places to inject into.

   ```html
   <!-- public/product-actions.global.html -->
   <content location="products-scripts"><script type="module" src="/shop/components/AddToCart.js"></script></content>
   <content location="products-card-actions"><k-shop-add-to-cart slot="actions"></k-shop-add-to-cart></content>
   <content location="products-detail-actions"><k-shop-add-to-cart slot="actions"></k-shop-add-to-cart></content>
   ```

7. **Put the layout in the component, around the slot.** If the elements in a slot should be laid out
   together (a row of buttons, a gap), style that in the component's own shadow DOM: wrap the `<slot>`
   in an element there and give the wrapper the styles (`display: flex; gap: …`). The styles live with
   the component that owns the layout, and contributors never need to know about them. Do not ask
   contributors to wrap their elements in a styled `<div>`.

8. **If there is a default way of doing it that an extension may want to replace, make it the slot's
   default content.** Content inside a `<slot>` shows only while nothing is assigned to the slot:

   ```javascript
   render(){
     return html`<slot name="price"><div class="tc-muted">${this.priceText}</div></slot>`;
   }
   ```

   A site with no extensions shows the normal price. An extension such as a sale extension puts its own
   element in the slot (`<k-sales-price slot="price">`, a struck-through price with the new one in
   green), and the default is replaced, with the component and its default left unchanged. The default must
   be real, working content, not a placeholder. The replacing element reads what it needs from the parent
   with `closest()` (the product, the config, a `money()` formatter). A slot meant to be *replaced* should
   have one owner: two contributors would both be shown. A slot meant to hold *several* things (actions)
   has no default content, and takes as many elements as are contributed.

### Giving other extensions somewhere to add

If your extension has a page or a component that others might add to, **declare the places**: put
`<location name="…" />` in your own pages, templates and fragments, and document each one as part of
your public API, as a table of name, where it appears and what belongs in it.

- **Name it with your extension's prefix** (`products-card-actions`, `checkout-after-total`), so names
  from different extensions never collide.
- **Locations stack; fragments pick one.** Any number of extensions fill a location and everything is
  merged and ordered by `priority` (highest first). A `<fragment>` has exactly one winner. Use a
  location for a list of things (buttons, badges, panels) and a fragment for one replaceable block.
- **An unfilled location renders nothing**, so a page works with none of its extensions installed.
- **Declare a scripts location** next to the markup locations, outside any `<template>`.
- **Offer a place per purpose**, not one big "extras". `…-actions` (controls), `…-extra` (more
  content) and `…-scripts` are easy for others to choose between and easy for you to restyle.

Extensions can both declare locations and fill locations that others declare.

### Pitfalls with the server templating

The server resolves `{{ }}` variables, `<if>`, `<foreach>`, `<fragment>` and `<location>` across a
page's whole text, including inside a `<template>` and inside HTML comments:

- **No `{{product.name}}`-style placeholders for data that belongs to an item.** The server replaces an
  unknown variable with nothing before the browser sees the page. Item data comes from the component
  (it reads the parent with `closest()` and renders itself), not from the template.
- **Never write a literal `<fragment …>` or `<location …>` tag in a comment** inside a fragment or page.
  It is resolved like any other, and a fragment that names itself in a comment recurses until it fails.

### Menu items

Navigation is the same idea with a built-in picker: see *Menu items* above. Offer a nav item with a
`*.menu-item.html` file and the admin adds it from the Menus page, instead of your script finding the
nav and putting something into it.

## Admin Pages

Place `.page.html` files in your `admin/` directory. They are accessible at `/admin/extensions/my-extension/`:

```
admin/
├── index.page.html     → /admin/extensions/my-extension/
└── settings.page.html  → /admin/extensions/my-extension/settings
```

Admin pages can use kempo-ui components and the frontend SDK.

## Icons Your Extension Ships

An icon that belongs to your extension goes with it, and is named by path, not by name. Where the SVG lives depends on who uses it:

- **Used by more than one extension, or by kempo itself** (a plus, a trash can, a file-kind glyph): kempo's shared set, `src/kempo/icons/`. Use it by name: `<k-icon name="add">`.
- **Used only in the admin** (a menu link, a settings page): `admin/icons/`, served at `/admin/extension/<your package name>/icons/`, to signed-in admins.
- **Used on the live site** (a button in a storefront component, a menu item): `public/icons/`, served at `/<your scope>/icons/`, to everyone. An icon used by both the admin and the site goes here too, since the admin can load it from there.

```html
<k-aside-item icon-src="/admin/extension/my-extension/icons/report.svg" href="…">Reports</k-aside-item>
<k-aside-item icon-src="/products/icons/products.svg" group="Products" group-icon-src="/products/icons/products.svg" href="…">Products</k-aside-item>
<k-icon src="/products/icons/products.svg"></k-icon>
```

`icon-src` and `group-icon-src` are for admin nav links (`group-icon-src` is the icon of the group's menu), and a `<menu-item>` takes `icon-src` too. The `icon` and `group-icon` attributes, and the aside's `group-icons` map, are icon *names* looked up in kempo's shared set. A dashboard widget takes `iconSrc` in `kempo-config.json` (and `iconSrc` on its call to action) for the same thing.

The icon is drawn by `<k-icon>`, which removes its `width` and `height` and fills it with the current text colour, so it takes the colour of the link it is in. Author it like the Material Symbols icons: one filled `<path>` and `viewBox="0 -960 960 960"`. An outlined (stroked) icon will not look right.

## Admin Component Overrides

An extension can swap in its own custom element for a named admin panel slot — for example, replacing the page/fragment content editor (`k-html-editor`) with a custom WYSIWYG. This is registered through `/admin/component-overrides.js`:

```javascript
import { registerComponentOverride } from '/admin/component-overrides.js';

registerComponentOverride('page-content-editor', 'my-ext-wysiwyg');
```

| Slot | Default | Used by |
|---|---|---|
| `page-content-editor` | `k-html-editor` | The Content/Head/Scripts editors on the page editor |

A replacement for `page-content-editor` must, at minimum: accept a `.value` property with the initial HTML, expose a `getValue()` method returning the current HTML, and support a boolean `disabled` attribute. It may ignore `controls`/`mode`, which are `k-html-editor`-specific.

**Registration must run after `/admin/init.js`.** The admin template loads `init.js` first and it does `window.kempo = {...}` — a full reassignment, not a merge — so anything set on `window.kempo` before that line runs is wiped out. Any `*.global.html` file in your extension's `admin/` directory is picked up automatically (same convention as `admin/nav.global.html` — no install step needed); target `location="head"` and it renders after `init.js`, same as the site template's `head` location:

```html
<!-- admin/register-editor-override.global.html -->
<content id="my-extension-editor-override" name="Editor Override" owner="my-extension" enabled="true" locked="true" location="head" priority="0">
<script type="module">
  import { registerComponentOverride } from '/admin/component-overrides.js';
  import '/admin/extension/my-extension/components/MyWysiwyg.js';
  registerComponentOverride('page-content-editor', 'my-ext-wysiwyg');
</script>
</content>
```

## Lifecycle Scripts

Use these only for logic that can't be expressed in the declarative config.

### `install.js`

Runs after all declarative config has been applied (tables created, permissions/settings/groups/hooks registered):

```javascript
export default async () => {
  // Custom setup that can't be expressed declaratively.
  // For example: registering a custom route in the consumer's config file.
};
```

### `uninstall.js`

Runs before declarative cleanup (tables dropped, permissions/settings/groups deleted):

```javascript
export default async () => {
  // Custom cleanup. For example: removing route registrations.
  // Do NOT delete data here that kempo will delete via the declarative config.
};
```

### `update.js`

Runs after all declarative diffs have been applied. Receives the old and new config for comparison:

```javascript
export default async ({ oldVersion, newVersion, oldKempo, newKempo }) => {
  // Column-level schema migrations, data transforms, etc.
  // Only run logic for specific version transitions using semver comparisons.
};
```

## Using the Server SDK

Your extension's server-side code (hooks, route handlers, lifecycle scripts) can import utilities from kempo's server SDK. See the [**Server SDK Guide**](sdk.md) for complete documentation of all available utilities.

Quick example:

```javascript
import {
  getUserById,
  getSetting,
  createHook,
  triggerHook,
  currentUserHasPermission,
} from 'kempo/server/sdk.js';
```

You can also import the database directly, but this should be a last resort, try and use the extensions `server/db/schema.js` file to create and manage updating the schema of db tables. And try and use the other sdk functions to interact with system tables, and if you need to interact with another extension it should provide its own sdk.

```javascript
import db from 'kempo/server/db/index.js';
import { user } from 'kempo/server/db/schema.js';
```

## Best Practices

### Naming

- **Prefix everything with your extension name**: tables (`blogPost`), permissions (`blog:posts:create`), settings (`blog:posts_per_page`), groups (`blog:Bloggers`). This prevents conflicts with other extensions and with kempo core.
- **Group names**: `extensionName:GroupName` (capital first letter for the group display name).

### Idempotency

Kempo installs are idempotent by design — `CREATE TABLE IF NOT EXISTS` and `INSERT ... ON CONFLICT DO NOTHING` mean running install twice is safe. Keep your own code idempotent too.

### Never Delete User Data on Uninstall Without Warning

When a user uninstalls your extension, they may want to keep their content. Consider either:
- Leaving tables in place (not using `schema` for tables with user content), or
- Documenting clearly that uninstalling will delete data

The declarative `DROP TABLE IF EXISTS` on uninstall is appropriate for configuration/system tables but not for user-generated content tables.

### Permissions: Declare All, Use Granularly

Declare all the permissions your extension might ever need at install time. It's better to have unused permissions than to add new ones in an update and break the expected access model. On update, new permissions are added but existing ones are never deleted.

### Settings: Provide Sensible Defaults

Every setting should have a default value that makes the extension work out of the box. Don't make site admins configure settings before the extension is functional.

### Update Script: Guard with Version Checks

In `update.js`, always check versions before running migrations:

```javascript
import semver from 'semver';

export default async ({ oldVersion, newVersion, oldKempo, newKempo }) => {
  if(semver.lt(oldVersion, '1.2.0')){
    // migrations for upgrading to 1.2.0
  }
  if(semver.lt(oldVersion, '1.3.0')){
    // migrations for upgrading to 1.3.0
  }
};
```

This makes the update script safe to run regardless of what version the user is upgrading from.

### Keep `install.js` Minimal

The declarative config handles the vast majority of setup. Reserve `install.js` for things that genuinely can't be expressed declaratively — like modifying the consumer's config files or calling external APIs.

## Publishing

Extensions are standard npm packages. Publish to npm:

```bash
npm publish
```

The `git` field in your `kempo-config.json` enables update detection:

```json
"git": "https://github.com/yourname/my-extension"
```

When users check for updates in the admin panel, kempo fetches the latest `package.json` from the `main` branch of this repository and compares the version. Only GitHub URLs are currently supported.

## Realtime Channels

An extension can push live updates to browsers by declaring a channel in `kempo-config.json` and publishing to it:

```json
"realtime": {
  "channels": [
    { "name": "status", "permission": "my-ext:status:read", "persist": true, "retention": "24h" },
    { "name": "arena", "permission": "my-ext:arena:play", "scope": "process", "dropIfBackedUp": true, "onMessage": "./handlers/arena.js" }
  ]
}
```

Channels are closed by default: `permission` is required, and only users who hold it can subscribe. `persist` stores messages so a client that reconnects can catch up, and `retention` says how long they are kept. `scope` is `"cluster"` (default) or `"process"` for fast in-memory traffic that never touches the database. `onMessage` is a path inside your package to a handler that receives what browsers send to the channel and can reply. `dropIfBackedUp` skips deliveries to a client that is already behind. The channel is named `my-ext:status`, and you publish with `realtime.publish({ channel, data })` from the [Server SDK](sdk.md).

Connections are observable through hooks, declared in `hooks` like any other: `realtime:connected`, `realtime:disconnected`, `realtime:subscribed`, `realtime:unsubscribed`, and the guard `realtime:before_subscribe`, which refuses a subscription when it throws `{ code, msg }`. Use hooks for lifecycle and `onMessage` for messages. See [Realtime](../realtime.md) for the full guide.

## Notifications

An extension can tell users about something that needs them, such as a failed background job, with `createNotification` from the [Server SDK](sdk.md#notifications). Target `userIds`, a `permission` or a `group`, give it a `dedupeKey` so a repeating failure is one notification, and attach up to three actions: a link, or an API call that the user's browser makes with their own session (so your route must check permissions itself). The admin shows a bell and a history page; a public site can use `<k-notification-bell>`. Notifications are optional for the user's core version: guard the call so your extension still works on a kempo that predates them. See [Notifications](../notifications.md).

## Reference

### Full `kempo-config.json` Schema

```json
{
  "git": "string — GitHub repo URL for update detection",
  "public-scope": "string — URL prefix for public/ files",
  "public-scopes": { "scope": "folder — more prefixes, each serving a folder of the package" },
  "schema": "string — relative path to Drizzle schema file",
  "hooks": {
    "event-name": "string — relative path to handler file"
  },
  "dependencies": ["array of extension names — must be installed and enabled first"],
  "jobs": [
    {
      "name": "string — lowercase letters, numbers and dashes",
      "every": "string or number — \"30s\", \"15m\", \"6h\" or milliseconds (at least one second)",
      "callback": "string — relative path to the handler file, starting with ./"
    }
  ],
  "aliases": {
    "/short-address": "/your-public-scope/real-address"
  },
  "permissions": [
    {
      "name": "string — owner:resource:action",
      "description": "string"
    }
  ],
  "settings": [
    {
      "name": "string — setting key (owner prefix added automatically)",
      "value": "string — default value",
      "type": "string | number | boolean | json | secret",
      "description": "string"
    }
  ],
  "groups": [
    {
      "name": "string — owner:GroupName",
      "description": "string",
      "permissions": ["array of permission names"]
    }
  ],
  "realtime": {
    "channels": [
      {
        "name": "string — channel name, becomes <extension-name>:<name>",
        "permission": "string — required; the permission a user needs to subscribe",
        "persist": "boolean — keep messages so clients can replay what they missed (default false)",
        "retention": "string or number — how long persisted messages are kept, e.g. \"24h\" (default 24h)"
      }
    ]
  }
}
```

### Install / Update / Uninstall Lifecycle

**Install:**
1. Check `kempo.dependencies` — fails with 409 if any named extension isn't installed and enabled
2. `CREATE TABLE IF NOT EXISTS` for each table in `schema`
3. Create permissions from `kempo.permissions`
4. Create settings from `kempo.settings`
5. Create groups from `kempo.groups` and assign their permissions
6. Register hooks from `hooks`
7. Run `install.js` (custom logic)
8. Save `kempo` config snapshot to DB

**Update:**
1. `npm install name@latest`
2. `CREATE TABLE IF NOT EXISTS` for any new tables
3. Add any new permissions (never remove)
4. Add any new settings (never overwrite changed values)
5. Add any new groups
6. Add new hooks, remove deleted hooks
7. Run `update.js` with `{ oldVersion, newVersion, oldKempo, newKempo }`
8. Save new `kempo` config snapshot to DB

**Enable:** checks `kempo.dependencies` (fails with 409 if any named extension isn't currently enabled), then flips `enabled` to `true`.

**Disable:** checks that no other enabled extension declares this one in its `kempo.dependencies` (fails with 409 if one does), then flips `enabled` to `false`.

**Uninstall:**
1. Check that no other enabled extension declares this one in its `kempo.dependencies` — fails with 409 if one does
2. Run `uninstall.js` (custom cleanup)
3. Delete hooks owned by the extension
4. Delete permissions from `kempo.permissions`
5. Delete settings from `kempo.settings`
6. Delete groups from `kempo.groups`
7. `DROP TABLE IF EXISTS` for each table in `schema`
8. Delete extension DB record
