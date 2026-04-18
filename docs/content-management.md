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
