# Pages

## Description
CMS content pages stored as `.page.html` files on disk. Each page uses a template for layout and contains content blocks that are placed into template locations. Pages are rendered server-side by kempo-server's template engine.

## Dependencies
- [Templates](templates.md) — every page uses a template for its layout
- [Fragments](fragments.md) — templates can include fragments
- [Global Content](global-content.md) — global entries are injected into template locations
- kempo-server — SSR rendering engine

## Context
Pages are the primary content unit of the CMS. They are file-based (not database-stored) which makes them version-controllable with git and editable with any text editor.

### Decisions
- **File-based storage**: Pages are `.page.html` files in the public directory tree. The URL structure mirrors the file structure.
- **Frontmatter metadata**: Page metadata (title, description, author, template) is stored in HTML comment frontmatter at the top of the file.
- **Template selection**: Each page specifies which template to use. The template defines the layout and available content locations.
- **Content blocks per location**: Page content is organized into blocks that target specific template locations (e.g., `head`, `scripts`, default body).
- **`rootDir` parameter**: All page utils accept a `rootDir` so they work with both the consumer's `public/` and extension directories.

## Implementation

### File Format
```html
<!--
  name: My Page
  title: My Page Title
  description: Page description
  author: Author Name
  template: default
-->
<location>
  <p>Main content goes here</p>
</location>
<location name="head">
  <style>/* page-specific styles */</style>
</location>
<location name="scripts">
  <script>/* page-specific scripts */</script>
</location>
```

### Server Utils (`server/utils/pages/`)
| Util | Signature | Purpose |
|---|---|---|
| `listPages` | `({ rootDir })` | List all pages in the public directory |
| `listDirectories` | `({ rootDir })` | List all directories |
| `listTemplates` | `({ rootDir })` | List available templates |
| `getPage` | `({ rootDir, file })` | Read page file with parsed frontmatter |
| `createPage` | `({ rootDir, directory, name, template, author })` | Create new page file |
| `updatePage` | `({ rootDir, file, name, title, description, author, template, contents })` | Update page content and metadata |
| `deletePage` | `({ rootDir, files })` | Delete page files |
| `movePage` | `({ rootDir, file, newFile })` | Rename/move page file |

### API Routes (`/kempo/api/pages/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:pages:read` | List pages |
| POST | `/` | `system:pages:create` | Create page |
| DELETE | `/` | `system:pages:delete` | Delete pages |
| GET | `/directories` | `system:pages:read` | List directories |
| GET | `/templates` | `system:pages:read` | List templates |
| GET | `/file` | `system:pages:read` | Get page file |
| PUT | `/file` | `system:pages:update` | Update page file |
| PATCH | `/file` | `system:pages:update` | Move page |

### Admin UI
- **List**: `/admin/content/pages/` — table with create, delete, link to editor
- **Editor**: `/admin/content/pages/edit/` — PageEditor component with template selection and per-location content editing

## Notes
- Pages are rendered on request by kempo-server. The template is applied, fragments are included, and global content is injected into locations.
- The admin page editor permission check requires `system:pages:update` via middleware.
