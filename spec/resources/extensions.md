# Extensions

## Description
A plugin system that allows third-party npm packages to extend kempo with new routes, admin pages, hooks, settings, permissions, groups, and database tables. Extensions are installed/uninstalled through the admin panel and registered in the database. Most lifecycle behavior is declared in the extension's `package.json` `kempo` config and handled automatically by kempo core.

## Dependencies
- [Database](../concepts/db.md) — `extension` and `hook` tables
- [Hooks](hooks.md) — extensions register event callbacks
- [Admin UI](../concepts/admin-ui.md) — extensions management page
- [Middleware](../concepts/middleware.md) — `extension-scope-router` serves extension public files
- [Settings](settings.md) — extensions can create their own settings
- [Permissions](permissions.md) — extensions can create their own permissions
- [Groups](groups.md) — extensions can create their own groups

## Context
Extensions enable third-party developers to add features to a kempo site without modifying core code. The first extension is `kempo-blog` which adds a blog system.

### Decisions
- **npm packages**: Extensions are standard npm packages with a `kempo` config in their `package.json`.
- **Declarative `kempo` config**: Extensions declare all capabilities in `package.json`. Kempo core handles hooks, schema, permissions, settings, and groups automatically — `install.js`/`update.js`/`uninstall.js` are only needed for custom logic that can't be expressed declaratively.
  ```json
  {
    "kempo": {
      "git": "https://github.com/author/my-extension",
      "docs": "https://github.com/author/my-extension#readme",
      "public-scope": "blog",
      "schema": "./server/db/schema.js",
      "hooks": {
        "page-created": "hooks/page-created.js"
      },
      "permissions": [
        { "name": "blog:posts:create", "description": "Create new blog posts" }
      ],
      "settings": [
        { "name": "recent_limit", "value": "5", "type": "number", "description": "Number of recent posts" }
      ],
      "groups": [
        { "name": "blog:Bloggers", "description": "Users who can write posts", "permissions": ["blog:posts:create"] }
      ]
    }
  }
  ```
- **`git` field**: URL to the extension's git repo. Kempo fetches the raw `package.json` from the default branch to detect available updates and compare by semver version.
- **`docs` field**: URL to the extension's documentation. Shown as a link in the admin UI extension detail view.
- **`schema` field**: Path to a Drizzle schema file exporting named table objects. On install, kempo generates `CREATE TABLE IF NOT EXISTS` for each exported table. On uninstall, kempo generates `DROP TABLE IF EXISTS`. On update, kempo re-runs `CREATE TABLE IF NOT EXISTS` for all exported tables (new tables are created; existing ones are no-ops); column-level migrations are left to `update.js`.
- **`permissions`/`settings`/`groups`**: Declared in kempo config. On install, all are created. On update, new ones are added and removed ones are left in place (user data may depend on them). On uninstall, all are deleted.
- **`hooks`**: On update, new hooks are registered and hooks removed from config are deleted.
- **`public-scope`**: On update, scope change is applied automatically. The scope determines the URL prefix under which the extension's `public/` directory is served by `extension-scope-router`. The enabled extensions list is cached in-memory (`server/utils/extensions/scopeCache.js`) and invalidated on every install/enable/disable/uninstall.
- **Display metadata from `package.json`**: `description`, `author`, `license`, and `kempo.docs` are not stored in the DB. They are read live from the installed package's `package.json` by `getExtension` and `listExtensions` and appended to the returned objects. The DB only stores what's needed for runtime behavior and update diffing.
- **Stored kempo config snapshot**: The full `kempo` config from `package.json` is stored as JSON in the `extension` DB record at install/update time. This allows diffing old vs new config during updates even after `npm install` overwrites the package.
- **Lifecycle scripts**: `install.js` and `uninstall.js` run for custom logic not covered by the declarative config. `update.js` receives `{ oldVersion, newVersion, oldKempo, newKempo }` for custom migration logic (e.g. column additions, data transforms).
- **Name as primary key**: Extension names (npm package names) are unique identifiers.
- **Known extensions registry**: `dist/admin/known-extensions.json` lists curated extensions that appear in the "available" section even if not installed as a dependency.
- **Available extensions scan**: The API scans `node_modules` for packages with `kempo` config to find installable extensions.

## Implementation

### Schema
```
extension:
  name        text  PK
  version     text
  enabled     boolean (default true)
  kempo       jsonb  -- snapshot of the kempo config at install/update time
  installedAt timestamp
  updatedAt   timestamp
```

### Extension Package Structure
```
my-extension/
├── package.json         # Must have "kempo" config
├── install.js           # Optional: custom install logic (runs after declarative config applied)
├── update.js            # Optional: custom update logic ({ oldVersion, newVersion, oldKempo, newKempo })
├── uninstall.js         # Optional: custom uninstall logic (runs before declarative config removed)
├── server/
│   └── db/
│       └── schema.js    # Drizzle table exports (if kempo.schema is set)
├── admin/
│   └── index.page.html  # Admin page — served at /admin/extension/{name}/
├── hooks/
│   └── *.js             # Hook handlers
└── public/
    └── ...              # Scoped public files — served at /{public-scope}/
```

### Install Flow
1. Resolve package from `node_modules`
2. Read `package.json` for version, description, and `kempo` config
3. If `kempo.schema` set: import schema file, run `CREATE TABLE IF NOT EXISTS` for each exported table
4. Create permissions from `kempo.permissions`
5. Create settings from `kempo.settings`
6. Create groups from `kempo.groups` and assign their permissions
7. Register hooks from `kempo.hooks`
8. Run `install.js` if present
9. Insert extension record with `kempo` config snapshot
10. Trigger `extension:installed` hook

### Update Flow
1. `npm install name@latest` in project cwd
2. Read new `package.json` and new `kempo` config
3. Load old `kempo` config from the stored DB snapshot
4. If `kempo.schema` changed: re-run `CREATE TABLE IF NOT EXISTS` for all exported tables
5. Diff `kempo.permissions`: create added ones (do not delete removed ones)
6. Diff `kempo.settings`: create added ones (do not overwrite existing values)
7. Diff `kempo.groups`: create added ones
8. Diff `kempo.hooks`: register added hooks, delete removed hooks
9. Update `public-scope` if changed
10. Run `update.js` if present, passing `{ oldVersion, newVersion, oldKempo, newKempo }`
11. Update extension DB record with new version and `kempo` config snapshot
12. Trigger `extension:updated` hook

### Uninstall Flow
1. Run `uninstall.js` if present (custom logic, e.g. preserve user data)
2. Delete hooks owned by the extension
3. Delete permissions from `kempo.permissions`
4. Delete settings from `kempo.settings`
5. Delete groups from `kempo.groups`
6. If `kempo.schema` set: run `DROP TABLE IF EXISTS` for each exported table
7. Delete extension record
8. Trigger `extension:uninstalled` hook

### Update Detection
When listing extensions, kempo can check for updates by:
1. Reading the `git` field from the stored `kempo` config snapshot
2. Constructing the raw `package.json` URL (e.g. `https://raw.githubusercontent.com/author/repo/main/package.json`)
3. Fetching it and comparing `version` to the installed version
4. Returning `{ hasUpdate: true, latestVersion }` if newer

### Server Utils (`server/utils/extensions/`)
| Util | Signature | Purpose |
|---|---|---|
| `listExtensions` | `({ limit, offset })` | List installed extensions |
| `getExtension` | `({ name })` | Get extension by name |
| `installExtension` | `({ name })` | Full install flow |
| `uninstallExtension` | `({ name })` | Full uninstall flow |
| `updateExtension` | `({ name })` | Full update flow |
| `enableExtension` | `({ name })` | Enable extension |
| `disableExtension` | `({ name })` | Disable extension |
| `checkExtensionUpdate` | `({ name })` | Fetch remote package.json and compare version |

### API Routes (`/kempo/api/extensions/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:extensions:read` | List installed |
| POST | `/` | `system:extensions:install` | Install extension |
| DELETE | `/` | `system:extensions:uninstall` | Uninstall extension |
| GET | `/available` | `system:extensions:read` | Scan for available |
| GET | `/known` | `system:extensions:read` | List known extensions |
| POST | `/[name]/enable` | `system:extensions:manage` | Enable |
| POST | `/[name]/disable` | `system:extensions:manage` | Disable |
| POST | `/[name]/update` | `system:extensions:manage` | Update to latest |
| GET | `/[name]/update-check` | `system:extensions:read` | Check for available update |

### Admin UI
- **Manager**: `/admin/extensions/` — two tables: installed extensions and available extensions; installed rows show "Update available" badge when a newer version is detected
- **Extension pages**: `/admin/extensions/{name}/` — served via `CATCH.js` which uses `renderExternalPage` to render the extension's admin pages

### Extension Scope Router (Middleware)
The `extension-scope-router` middleware serves static files from enabled extensions' `public/` directories based on their `public-scope` config. Currently only handles static files — does not support route handler execution or templating.

## Notes
- Extensions can access the full server SDK (`kempo/server/sdk.js`) for database operations, user management, etc.
- The admin nav item for extensions uses the `extension` icon.
- `kempo-blog` is the reference implementation extension.
- The scope router's static-only limitation means extension pages with `.page.html` templates and API routes need the kempo-server routing/templating integration to work fully.
- Column-level schema migrations (adding/removing columns, changing types) are intentionally left to `update.js`. Only table-level creation/deletion is handled automatically — this keeps automatic behavior safe and predictable.
# Extensions

## Description
A plugin system that allows third-party npm packages to extend kempo with new routes, admin pages, hooks, settings, and UI. Extensions are installed/uninstalled through the admin panel and registered in the database.

## Dependencies
- [Database](../concepts/db.md) — `extension` and `hook` tables
- [Hooks](hooks.md) — extensions register event callbacks
- [Admin UI](../concepts/admin-ui.md) — extensions management page
- [Middleware](../concepts/middleware.md) — `extension-scope-router` serves extension public files
- [Settings](settings.md) — extensions can create their own settings
- [Permissions](permissions.md) — extensions can create their own permissions
- [Groups](groups.md) — extensions can create their own groups

## Context
Extensions enable third-party developers to add features to a kempo site without modifying core code. The first extension is `kempo-blog` which adds a blog system.

### Decisions
- **npm packages**: Extensions are standard npm packages with a `kempo` config in their `package.json`.
- **`kempo` config in package.json**: Extensions declare their capabilities:
  ```json
  {
    "kempo": {
      "public-scope": "blog",
      "hooks": {
        "page-created": "hooks/page-created.js"
      }
    }
  }
  ```
- **Install/uninstall lifecycle**: Extensions have `install.js` and `uninstall.js` scripts that run during installation/removal. These can create DB tables, seed data, register admin globals, etc.
- **`public-scope`**: Maps a URL prefix to the extension's `public/` directory. `"public-scope": "blog"` makes the extension's public files available at `/blog/**`.
- **Name as primary key**: Extension names (npm package names) are unique identifiers.
- **Known extensions registry**: `dist/admin/known-extensions.json` lists curated extensions that appear in the "available" section even if not installed as a dependency.
- **Available extensions scan**: The API scans `node_modules` for packages with `kempo` config to find installable extensions.

## Implementation

### Schema
```
extension:
  name        text  PK
  version     text
  description text
  enabled     boolean (default true)
  installedAt timestamp
  updatedAt   timestamp
```

### Extension Package Structure
```
kempo-blog/
├── package.json    # Must have "kempo" config
├── install.js      # Runs on install
├── uninstall.js    # Runs on uninstall
├── sdk.js          # Extension SDK (optional)
├── admin/
│   └── index.page.html  # Admin page
├── hooks/
│   └── page-created.js  # Hook handlers
└── public/
    └── ...              # Scoped public files
```

### Install Flow
1. Resolve package from `node_modules`
2. Read `package.json` for version, description, and `kempo` config
3. Run `install.js` (receives server SDK)
4. Register hooks from `kempo.hooks` config
5. Insert extension record in DB
6. Trigger `extension:installed` hook

### Uninstall Flow
1. Run `uninstall.js` (receives server SDK)
2. Delete all hooks owned by the extension
3. Delete extension record from DB
4. Trigger `extension:uninstalled` hook

### Server Utils (`server/utils/extensions/`)
| Util | Signature | Purpose |
|---|---|---|
| `listExtensions` | `({ limit, offset })` | List installed extensions |
| `getExtension` | `({ name })` | Get extension by name |
| `installExtension` | `({ name })` | Full install flow |
| `uninstallExtension` | `({ name })` | Full uninstall flow |
| `enableExtension` | `({ name })` | Enable extension |
| `disableExtension` | `({ name })` | Disable extension |
| `updateExtension` | `({ name, version, description })` | Update metadata |

### API Routes (`/kempo/api/extensions/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:extensions:read` | List installed |
| POST | `/` | `system:extensions:install` | Install extension |
| DELETE | `/` | `system:extensions:uninstall` | Uninstall extension |
| GET | `/available` | `system:extensions:read` | Scan for available |
| GET | `/known` | `system:extensions:read` | List known extensions |
| POST | `/[name]/enable` | `system:extensions:manage` | Enable |
| POST | `/[name]/disable` | `system:extensions:manage` | Disable |

### Admin UI
- **Manager**: `/admin/extensions/` — two tables: installed extensions and available extensions
- **Extension pages**: `/admin/extensions/{name}/` — served via `CATCH.js` which uses `renderExternalPage` to render the extension's admin pages

### Extension Scope Router (Middleware)
The `extension-scope-router` middleware serves static files from enabled extensions' `public/` directories based on their `public-scope` config. Currently only handles static files — does not support route handler execution or templating.

## Notes
- Extensions can access the full server SDK (`kempo/server/sdk.js`) for database operations, user management, etc.
- The admin nav item for extensions uses the `extension` icon.
- `kempo-blog` is the reference implementation extension.
- The scope router's static-only limitation means extension pages with `.page.html` templates and API routes need the kempo-server routing/templating integration to work fully.
