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
- **`id="main"` on the page body wrapper**: the scaffolded `default.template.html` gives its `<main>` an id so that a `*.template-patch.html` can replace it. This is a contract, not decoration — see below.

### Template Patches

kempo-server ≥3.4.0 supports `*.template-patch.html`: a file that describes changes to another template rather than being one. A page's `template="x"` resolves to `x.template.html` first, then `x.template-patch.html`.

This is how an extension gives pages a different wrapper without copying the site's template. `kempo-blog` uses it — its generated `post/blog-post.template-patch.html` is:

```html
<!--
  owner: kempo-blog
  extends: default
  locked: true
-->
<replace id="main">
  <article>
    <fragment name="blog-post-header" />
    <location />
    <fragment name="blog-post-comments" />
  </article>
</replace>
```

**`id="main"` in `app-public/default.template.html` is load-bearing.** Patch operations target one element by id and **throw when that id is absent**, so renaming or removing it breaks every patch naming it — visibly, at render time, for the pages that use them. A site whose template predates the attribute has a bare `<main>`; `kempo-blog`'s install/update adds the id when there is exactly one `<main>`, and reports it rather than guessing when there is not.

The alternative this replaced was generating a *copy* of the site's default template per extension. A copy is a snapshot: it stopped matching the moment the site edited its own template, silently, and could not be reliably invalidated because editing a template usually means opening the file, which fires no hook.

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
| `createTemplate` | `({ rootDir, directory, name, author, owner, copyFrom })` | Create new template. `owner` defaults to `'custom'` — set by extension SDK callers, never accepted from the public API |
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
