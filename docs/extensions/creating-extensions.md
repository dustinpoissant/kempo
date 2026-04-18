# Creating Extensions

Extensions are standard npm packages with a `kempo` config in their `package.json`. Kempo reads this config to automatically handle database tables, permissions, settings, groups, and event hooks when the extension is installed, updated, or uninstalled.

## Minimal Extension

The minimum required for a kempo extension is a `package.json` with a `kempo` object:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "kempo": {}
}
```

That's a valid (though empty) extension. Anything you declare in `kempo` is handled automatically by kempo core.

## Package Structure

```
my-extension/
├── package.json          # Required — declares the kempo config
├── install.js            # Optional — custom install logic
├── update.js             # Optional — custom migration logic
├── uninstall.js          # Optional — custom uninstall logic
├── server/
│   └── db/
│       └── schema.js     # Database tables (if kempo.schema is set)
├── hooks/
│   └── *.js              # Event hook handlers
├── admin/
│   └── index.page.html   # Admin page
└── public/
    └── ...               # Public-facing pages and assets
```

## The `kempo` Config

All extension capabilities are declared in the `kempo` field of `package.json`:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "kempo": {
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
}
```

### Config Fields

| Field | Purpose |
|---|---|
| `git` | GitHub URL used to detect available updates |
| `public-scope` | URL prefix for the extension's `public/` directory |
| `schema` | Path to a Drizzle schema file |
| `permissions` | Permissions to create on install |
| `settings` | Settings to create on install |
| `groups` | Groups to create on install, with their assigned permissions |
| `hooks` | Event hooks to register (`{ "event-name": "path/to/handler.js" }`) |

## Database Tables

Create a Drizzle schema file and point `kempo.schema` at it:

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

Read them at runtime:

```javascript
import getSetting from 'kempo/server/utils/settings/getSetting.js';

const perPage = await getSetting('my-ext', 'posts_per_page', 10);
const commentsEnabled = await getSetting('my-ext', 'allow_comments', true);
```

Settings appear in the admin panel at `/admin/settings` grouped by owner. Site admins can change them without a code deploy.

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

Hooks let your extension react to events in the CMS. Declare them in `kempo.hooks`:

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

### Built-in Events

| Event | Data | When |
|---|---|---|
| `extension:installed` | `{ name, version }` | After any extension is installed |
| `extension:uninstalled` | `{ name }` | After any extension is uninstalled |
| `extension:updated` | `{ name, oldVersion, newVersion }` | After any extension is updated |
| `page-created` | `{ page }` | After a page is created |

## Public Routes

Set `kempo.public-scope` to a URL prefix. Files in your `public/` directory are served under that prefix:

```json
"public-scope": "blog"
```

With this, `public/index.page.html` is served at `/blog/`, `public/posts.page.html` at `/blog/posts`, etc.

The `extension-scope-router` middleware handles static file serving. Dynamic route handlers (`.js` files) and server-side templating are not currently supported in extension public files — use kempo's API routes for dynamic behavior.

## Admin Pages

Place `.page.html` files in your `admin/` directory. They are accessible at `/admin/extensions/my-extension/`:

```
admin/
├── index.page.html     → /admin/extensions/my-extension/
└── settings.page.html  → /admin/extensions/my-extension/settings
```

Admin pages can use kempo-ui components and the frontend SDK.

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

Your extension's server-side code (hooks, route handlers, lifecycle scripts) can import from kempo's server SDK:

```javascript
import {
  getUser,
  getSetting,
  createHook,
  triggerHook,
} from 'kempo/server/sdk.js';
```

Or import individual utils directly:

```javascript
import getSetting from 'kempo/server/utils/settings/getSetting.js';
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
- Leaving tables in place (not using `kempo.schema` for tables with user content), or
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

The `git` field in your `kempo` config enables update detection:

```json
"kempo": {
  "git": "https://github.com/yourname/my-extension"
}
```

When users check for updates in the admin panel, kempo fetches the latest `package.json` from the `main` branch of this repository and compares the version. Only GitHub URLs are currently supported.

## Reference

### Full `kempo` Config Schema

```json
{
  "kempo": {
    "git": "string — GitHub repo URL for update detection",
    "public-scope": "string — URL prefix for public/ files",
    "schema": "string — relative path to Drizzle schema file",
    "hooks": {
      "event-name": "string — relative path to handler file"
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
        "type": "string | number | boolean",
        "description": "string"
      }
    ],
    "groups": [
      {
        "name": "string — owner:GroupName",
        "description": "string",
        "permissions": ["array of permission names"]
      }
    ]
  }
}
```

### Install / Update / Uninstall Lifecycle

**Install:**
1. `CREATE TABLE IF NOT EXISTS` for each table in `kempo.schema`
2. Create permissions from `kempo.permissions`
3. Create settings from `kempo.settings`
4. Create groups from `kempo.groups` and assign their permissions
5. Register hooks from `kempo.hooks`
6. Run `install.js` (custom logic)
7. Save `kempo` config snapshot to DB

**Update:**
1. `npm install name@latest`
2. `CREATE TABLE IF NOT EXISTS` for any new tables
3. Add any new permissions (never remove)
4. Add any new settings (never overwrite changed values)
5. Add any new groups
6. Add new hooks, remove deleted hooks
7. Run `update.js` with `{ oldVersion, newVersion, oldKempo, newKempo }`
8. Save new `kempo` config snapshot to DB

**Uninstall:**
1. Run `uninstall.js` (custom cleanup)
2. Delete hooks owned by the extension
3. Delete permissions from `kempo.permissions`
4. Delete settings from `kempo.settings`
5. Delete groups from `kempo.groups`
6. `DROP TABLE IF EXISTS` for each table in `kempo.schema`
7. Delete extension DB record
