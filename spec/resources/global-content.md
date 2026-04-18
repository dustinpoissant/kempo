# Global Content

## Description
HTML entries that are automatically injected into specific template locations across all pages. Managed through a single `.global.html` file containing multiple entries, each targeting a named location with a priority for ordering.

## Dependencies
- [Templates](templates.md) — global content targets template `<location>` tags
- kempo-server — global content injection during rendering

## Context
Global content provides a way to add HTML to every page without modifying individual pages or templates. Common uses: analytics scripts, site-wide notifications, shared CSS imports.

### Decisions
- **Single file per scope**: All global entries for a scope live in one `.global.html` file (e.g., `kempo-global.global.html`). Entries are separated within the file.
- **Location targeting**: Each entry specifies which template location it targets (`head`, `scripts`, or default body).
- **Priority ordering**: Entries have a numeric priority that controls injection order within a location.
- **Can be disabled**: Global files can be renamed with `-disabled` suffix (e.g., `kempo-global.global-disabled.html`).
- **ID-based management**: Each entry has a unique ID (UUID) for individual CRUD operations.

### Admin Global Content
There is a separate system for admin-scoped global content (`server/utils/admin-global-content/`) that works similarly but targets the admin template. These entries also have an `enabled` flag (stored as an HTML attribute) that can be toggled without renaming the file. This is used by extensions to inject UI into the admin panel.

## Implementation

### File Format (`kempo-global.global.html`)
```html
<!--
  id: uuid-1
  name: Analytics
  location: head
  priority: 100
  author: Admin
-->
<script src="/analytics.js"></script>
<!--
  id: uuid-2
  name: Footer Notice
  location:
  priority: 50
  author: Admin
-->
<p class="text-center text-muted">© 2026 My Site</p>
```

### Server Utils (`server/utils/global-content/`)
| Util | Signature | Purpose |
|---|---|---|
| `listGlobalContent` | `({ rootDir })` | List all entries |
| `getGlobalContent` | `({ rootDir, id })` | Get entry by ID |
| `createGlobalContent` | `({ rootDir, name, location, priority, author })` | Create entry |
| `updateGlobalContent` | `({ rootDir, id, name, location, priority, markup })` | Update entry |
| `deleteGlobalContent` | `({ rootDir, ids })` | Delete entries |

### Admin Global Content Utils (`server/utils/admin-global-content/`)
Same pattern but with additional `owner` field and `enable`/`disable` operations:
- `createAdminGlobalContent`, `deleteAdminGlobalContent`, `deleteAdminGlobalContentByOwner`
- `enableAdminGlobalContent`, `disableAdminGlobalContent`
- `getAdminGlobalContent`, `listAdminGlobalContent`, `updateAdminGlobalContent`

### API Routes
**Consumer globals** (`/kempo/api/globals/`):
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:globals:read` | List entries |
| POST | `/` | `system:globals:create` | Create entry |
| DELETE | `/` | `system:globals:delete` | Delete entries |
| GET | `/entry` | `system:globals:read` | Get entry |
| PUT | `/entry` | `system:globals:update` | Update entry |

**Admin globals** (`/kempo/api/admin-globals/`):
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | — | List admin entries |
| POST | `/` | — | Create admin entry |
| DELETE | `/` | — | Delete admin entries |
| GET | `/[id]` | — | Get admin entry |
| PUT | `/[id]` | — | Update admin entry |
| PUT | `/[id]/enable` | — | Enable admin entry |
| PUT | `/[id]/disable` | — | Disable admin entry |

### Admin UI
- **List**: `/admin/content/globals/` — table with create, delete, link to editor
- **Editor**: `/admin/content/globals/edit/` — GlobalContentEditor with Monaco and location/priority fields

## Notes
- Extensions use admin global content to inject scripts and UI into the admin panel.
- `deleteAdminGlobalContentByOwner` is used during extension uninstall to clean up all admin globals created by that extension.
