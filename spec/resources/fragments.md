# Fragments

## Description
Reusable HTML snippets stored as `.fragment.html` files. Fragments are included in templates and pages using `<fragment name="..." />` tags and rendered server-side by kempo-server.

## Dependencies
- kempo-server — fragment inclusion during rendering

## Context
Fragments provide a way to share common HTML across multiple pages without duplicating code. The most common use case is navigation — a `nav.fragment.html` is included in every template.

### Decisions
- **File-based storage**: Fragments are `.fragment.html` files in the public directory.
- **Frontmatter metadata**: Fragment metadata (name, author) in HTML comment frontmatter.
- **Included by name**: The `<fragment name="nav" />` tag tells kempo-server to find and include the `nav.fragment.html` file.
- **Can be disabled**: Fragment files can be renamed with `-disabled` suffix (e.g., `nav.fragment-disabled.html`) to exclude them from rendering.
- **Extensions can supply and override fragments**: an enabled extension's `public/` (site) or `admin/` (admin portal) directory is searched alongside the site's own tree. See [Cross-Package Resolution](#cross-package-resolution).

## Cross-Package Resolution

A fragment name can be offered by more than one source: the site's own tree, and any enabled
extension package. Because a `<fragment>` tag inserts exactly one thing, those sources **compete**
rather than merge — unlike global content, where every contribution to a `<location>` is combined.

A fragment file's own `<fragment>` wrapper may carry a `priority` (higher wins, default `0`):

```html
<!-- my-extension/public/add-to-cart.fragment.html -->
<fragment priority="10">
  <button>Notify me when back in stock</button>
</fragment>
```

Resolution order (implemented in kempo-server's templating engine):

1. The site's own walk-up from the page's directory to the root runs **unchanged**, yielding at most
   one candidate — the nearest match. Directory shadowing within the site behaves exactly as it
   always has.
2. Each enabled extension directory contributes at most one more candidate.
3. Highest `priority` wins. Extension directories compete on priority alone, never proximity — they
   sit outside the site's directory chain, so there is no distance to compare them by.
4. A tie keeps the site's own file; a tie between two extensions keeps whichever was scanned first.
   Overriding something the site already has is therefore always deliberate, never an accident of
   install order.
5. If no source has it, the calling tag's inline fallback renders.

This is what lets one extension override another's fragment — e.g. a default "add to cart" block
replaced by one that handles out-of-stock items — without the extension being overridden knowing
anything about it.

Extension-supplied fragments are read from the package at render time and require no install step
and no cleanup on uninstall; a disabled extension simply drops out of the scan. This is distinct
from the `createFragment` CRUD utils below, which manage admin-authored fragments stored in the
consumer's project.

## Implementation

### File Format
```html
<!--
  name: Navigation
  author: Author Name
-->
<nav>
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

### Server Utils (`server/utils/fragments/`)
| Util | Signature | Purpose |
|---|---|---|
| `listFragments` | `({ rootDir })` | List all fragments (includes `disabled: true/false` field) |
| `getFragment` | `({ rootDir, file })` | Read fragment with parsed frontmatter |
| `createFragment` | `({ rootDir, directory, name, author, owner })` | Create new fragment. `owner` defaults to `'custom'` — set by extension SDK callers, never accepted from the public API |
| `updateFragment` | `({ rootDir, file, name, author, markup })` | Update fragment markup |
| `deleteFragment` | `({ rootDir, files })` | Delete fragment files |
| `disableFragment` | `({ rootDir, file })` | Rename `.fragment.html` → `.fragment-disabled.html` |
| `enableFragment` | `({ rootDir, file })` | Rename `.fragment-disabled.html` → `.fragment.html` |

### API Routes (`/kempo/api/fragments/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:fragments:read` | List fragments |
| POST | `/` | `system:fragments:create` | Create fragment |
| DELETE | `/` | `system:fragments:delete` | Delete fragments |
| GET | `/file` | `system:fragments:read` | Get fragment file |
| PUT | `/file` | `system:fragments:update` | Update fragment file |
| PUT | `/disable` | `system:fragments:update` | Disable fragment |
| PUT | `/enable` | `system:fragments:update` | Enable fragment |

### Admin UI
- **List**: `/admin/content/fragments/` — table with create, delete, link to editor
- **Editor**: `/admin/content/fragments/edit/` — FragmentEditor with Monaco code editor

## Notes
- The consumer project ships with a `nav.fragment.html` for site navigation.
- The admin has its own `nav.fragment.html` for the sidebar.
