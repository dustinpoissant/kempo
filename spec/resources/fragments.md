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
| `listFragments` | `({ rootDir })` | List all fragments |
| `getFragment` | `({ rootDir, file })` | Read fragment with parsed frontmatter |
| `createFragment` | `({ rootDir, directory, name, author })` | Create new fragment |
| `updateFragment` | `({ rootDir, file, name, author, markup })` | Update fragment markup |
| `deleteFragment` | `({ rootDir, files })` | Delete fragment files |

### API Routes (`/kempo/api/fragments/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:fragments:read` | List fragments |
| POST | `/` | `system:fragments:create` | Create fragment |
| DELETE | `/` | `system:fragments:delete` | Delete fragments |
| GET | `/file` | `system:fragments:read` | Get fragment file |
| PUT | `/file` | `system:fragments:update` | Update fragment file |

### Admin UI
- **List**: `/admin/content/fragments/` — table with create, delete, link to editor
- **Editor**: `/admin/content/fragments/edit/` — FragmentEditor with Monaco code editor

## Notes
- The consumer project ships with a `nav.fragment.html` for site navigation.
- The admin has its own `nav.fragment.html` for the sidebar.
