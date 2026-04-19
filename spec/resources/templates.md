# Templates

## Description
HTML page layouts stored as `.template.html` files. Templates define the structure of a page and declare `<location>` slots where page content and global content are placed.

## Dependencies
- kempo-server — template rendering engine
- [Fragments](fragments.md) — templates include fragments with `<fragment>` tags
- [Global Content](global-content.md) — global entries target template locations

## Context
Templates are the outermost layer of the rendering pipeline. They define `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>` structure. Pages select a template and fill its locations.

### Decisions
- **File-based storage**: Templates are `.template.html` files in the public directory.
- **Frontmatter metadata**: Template metadata (owner, locked, name, author) in HTML comment frontmatter.
- **`<location>` tags**: Named slots where content is placed. The unnamed `<location />` is the default body content area.
- **`<fragment>` tags**: Include reusable HTML snippets by name.
- **System templates are locked**: Templates with `locked: true` in frontmatter cannot be edited through the admin UI. The admin template (`dist/admin/default.template.html`) is locked.
- **`{{pathToRoot}}`**: kempo-server variable for relative paths to the public root.
- **`{{title}}`**: kempo-server variable replaced with the page's title from frontmatter.
- **`copyFrom` on create**: New templates can be created as copies of existing templates.

## Implementation

### File Format
```html
<!--
  owner: system
  locked: false
  name: My Template
  author: Author Name
-->
<!DOCTYPE html>
<html lang="en">
<head>
  <title>{{title}}</title>
  <link rel="stylesheet" href="{{pathToRoot}}kempo-css/kempo.min.css">
  <location name="head" />
</head>
<body>
  <fragment name="nav" />
  <main>
    <location />
  </main>
  <location name="scripts" />
</body>
</html>
```

### Server Utils (`server/utils/templates/`)
| Util | Signature | Purpose |
|---|---|---|
| `getTemplate` | `({ rootDir, file })` | Read template file with parsed frontmatter |
| `createTemplate` | `({ rootDir, directory, name, author, copyFrom })` | Create new template |
| `updateTemplate` | `({ rootDir, file, name, author, markup })` | Update template markup |
| `deleteTemplate` | `({ rootDir, files })` | Delete template files |
| `disableTemplate` | `({ rootDir, file })` | Rename `.template.html` → `.template-disabled.html` |
| `enableTemplate` | `({ rootDir, file })` | Rename `.template-disabled.html` → `.template.html` |

### API Routes (`/kempo/api/templates/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:pages:read` | List templates |
| POST | `/` | `system:pages:create` | Create template |
| DELETE | `/` | `system:pages:delete` | Delete templates |
| GET | `/file` | `system:pages:read` | Get template file |
| PUT | `/file` | `system:pages:update` | Update template file |

### Admin UI
- **List**: `/admin/content/templates/` — table with create, delete, link to editor
- **Editor**: `/admin/content/templates/edit/` — TemplateEditor with Monaco code editor

## Notes
- The consumer project ships with two templates: `default.template.html` (standard layout) and `split.template.html` (split layout).
- The admin has its own template (`dist/admin/default.template.html`) that uses absolute paths and `<k-main>` instead of `<main>`.
