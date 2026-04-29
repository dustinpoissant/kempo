# Content Management

Kempo stores content as files on disk using [kempo-server's templating system](https://github.com/dustinpoissant/kempo-server). There are four types of content files.

## Pages

Pages are `.page.html` files that produce a rendered HTML response. They use frontmatter metadata and reference a template by name.

```html
---
title: About Us
template: default
---
<h1>About Us</h1>
<p>Welcome to our site.</p>
```

Pages are managed in the Admin under **Content > Pages**.

### Dynamic Pages

To create a page with a URL parameter, use a `[param]` directory:

```
public/blog/[slug]/index.page.html
```

That page can read `{{slug}}` from the URL via the kempo-server templating variables.

## Templates

Templates are `.template.html` files that wrap page content. They define named `locations` where content is injected.

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{title}} — My Site</title>
</head>
<body>
  <header>
    {{include: nav}}
  </header>
  <main>
    {{location: content}}
  </main>
</body>
</html>
```

A page targets a template by name via its frontmatter `template` field. Content pages are rendered into the `content` location.

## Fragments

Fragments are `.fragment.html` files — reusable HTML snippets included inside templates or other pages.

```html
<!-- nav.fragment.html -->
<nav>
  <a href="/">Home</a>
  <a href="/blog">Blog</a>
</nav>
```

Include a fragment with `{{include: nav}}` (omit the `.fragment.html` extension and path prefix when it's in the same directory).

## Global Content

Global content entries are `.global.html` files that are injected into template locations across all pages that use that template. They're useful for things like site-wide banners or announcement bars that should appear on every page without editing every template.

## Resource Locking

Resources (pages, templates, fragments, and global content) can be locked to prevent modification through the admin interface and public APIs. This is useful for protecting content that is managed by extensions or developers.

### Why Lock Resources?

Resource locks serve two main purposes:

1. **Extension-managed content**: When an extension creates and manages its own content (e.g., blog posts, comments, etc.), locking prevents accidental editing through the admin interface while still allowing the extension to update it programmatically.

2. **Developer-controlled content**: Developers can lock resources that should not be changed through the CMS UI, ensuring critical content remains stable.

### How Locking Works

**In the Admin Interface:**
- Locked resources show a lock icon 🔒 in the resource list
- The edit panel displays a warning banner explaining why it's locked
- Edit buttons are disabled; metadata inputs are read-only
- Users cannot delete, move, or disable locked resources

**For API Requests:**
- All API requests to update, delete, move, or disable locked resources return `403 Forbidden`
- This applies to direct HTTP requests (e.g., with Postman) and admin UI requests

**For Extensions via SDK:**
- Extensions can still modify resources they own by using `force: true` in update calls
- Or by calling lock utility functions (`setPageLocked`, `setTemplateLocked`, etc.)
- This allows extensions to manage their own locked resources

### Viewing Lock Status

In the admin panel, look for the lock icon next to locked resources. Hover over it (or click the resource) to see the lock owner:

- **"Locked by developer"** — A developer locked this resource as a safeguard (set `locked: true` directly in the file)
- **"Managed by: [extension name]"** — An extension created and manages this resource
- **"Managed by: external system"** — A third-party system manages this resource

### Locking a Resource

**From the Admin Panel:**
Click the lock icon on a resource to toggle its locked status. Only unlocked resources show the toggle.

**Programmatically (via Extension SDK):**

```javascript
import { setPageLocked, setTemplateLocked, setFragmentLocked, setGlobalContentLocked } from 'kempo/server/sdk.js';

// Lock a page
await setPageLocked({ file: 'blog/my-post.page.html', locked: true });

// Lock a template
await setTemplateLocked({ file: 'post-layout.template.html', locked: true });

// Lock a fragment
await setFragmentLocked({ file: 'sidebar.fragment.html', locked: true });

// Lock global content
await setGlobalContentLocked({ id: 'content-id-123', locked: true });
```

**Directly in the File (Pages, Templates, Fragments only):**

Add `locked: true` to the frontmatter:

```html
<!--
name: my-page
locked: true
title: My Locked Page
-->
<h1>Content</h1>
```

### Unlocking a Resource

Use the same methods as locking, but pass `locked: false`:

```javascript
await setPageLocked({ file: 'blog/post.page.html', locked: false });
```

## Admin Panel

All content types are managed through the admin panel:

| Admin Page | Path |
|---|---|
| Pages | `/admin/content/pages` |
| Templates | `/admin/content/templates` |
| Fragments | `/admin/content/fragments` |
| Global Content | `/admin/content/globals` |

## Templating Syntax

Kempo-server templates support:

| Syntax | Purpose |
|---|---|
| `{{variableName}}` | Insert a variable |
| `{{include: fragmentName}}` | Include a fragment |
| `{{location: locationName}}` | Define an injectable location |

See the [kempo-server templating docs](https://github.com/dustinpoissant/kempo-server) for the complete reference.
