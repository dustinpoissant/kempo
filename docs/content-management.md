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

## Menus

**Admin → Content → Menus** lists the places in your theme that can show a menu, with a dropdown for each to pick the menu it shows, or **None**. Below it is a table of the menus on your site, with the places each one is shown in and how many links it has. **Create Menu** makes an empty menu and opens it. Open a menu to edit its links, and tick the places that should show it. To add a link to the main menu, open it and click **Add item**: pick a page from the list (the site's own, and the pages extensions serve under their addresses, such as `/products/` or `/categories/`) or type any address, optionally add an icon or open it in a new tab. Drag links into order, hide one without deleting it, edit or delete it.

A place is a `<location>` with `menu="true"`:

```html
<location name="main-nav-links" label="Main menu" menu="true" />
```

`name` is how the theme refers to it and `label` is what the Menus page calls it. Each place is one row in the table until a link is added, and the page finds them in your templates, fragments and pages. So to get another menu, such as a footer or a mobile menu, put one where you want the links, **wrapped in your own element** (the links are bare `<a>` tags, so your element sets the layout and spacing), and reload the page. The default theme has a footer that does this (`footer.fragment.html`, rendered by the template after the main content):

```html
<footer class="d-f px py" style="gap: var(--spacer);">
  <location name="footer-links" label="Footer" menu="true" />
</footer>
```

New sites have the main menu in the navigation fragment. On an older site, add the `<location … menu="true" />` to your navigation and it appears.

- **No setup.** The first link added to a place makes the menu behind it, named after the place. You never have to create one.
- **Same links in two places.** In a menu's **Locations** section, tick the same menu for two locations and both show the same links; editing either changes both. Unticking a location, or choosing **None**, takes the menu away from it.
- **Spacer.** In **Add item**, choose **Spacer** (under *Built in*) to add a flexible gap. In a menu laid out in a row, like a navigation bar, it pushes the items after it to the far side, so the account link can sit on the right with your links on the left. It is kempo's own, so it is always offered, and it renders as `<div class="flex"></div>`, which needs the menu's parent to be a flex row (`d-f`). It does nothing in a menu stacked vertically.
- **Items from extensions.** In **Add item**, the first choice is *A link*, *Spacer*, or an item an installed extension offers (a cart button, say). Choosing one adds it with nothing else to fill in. It is placed, ordered, hidden and deleted like a link, and its markup comes from the extension: it cannot be edited here, it disappears from the site if the extension is disabled or removed (and is marked on this page), and returns if the extension does. Extension authors offer one with a `*.menu-item.html` file; see [Creating Extensions](extensions/creating-extensions.md#menu-items-menu-itemhtml).
- **Extensions' links.** What an extension adds to a place from its own `public/*.global.html` (a shop link, say) still appears there next to your links. The page lists it under the place, read-only, because it belongs to the extension.
- **Links you already have.** A single link placed in a menu place as global content is listed there with **Manage here**, which moves it in with the rest. Nothing is converted unless you ask, and anything that is more than one link is left alone.
- **A place the theme no longer has** is still listed, with a note, so its links can be reached. A menu no place shows is listed at the end, where it can be deleted.
- Needs the global content permissions: `system:globals:read` to see the page, `create` to add links, `update` to edit, reorder, hide and choose which links a place shows, `delete` to delete.
- Flat menus only; dropdowns are not supported yet.

### How menus are stored

Nothing new is stored: a menu is global content in `kempo-global.global.html`, so any template renders it. A menu is an entry with `menu-locations` naming where it is shown, its items are entries with `menu="<the menu's id>"` holding one link each, and these live in a place no template has. The site renders **copies** of the enabled items, one set per place the menu is shown (`menu-copy="<the item's id>"`). An item from an extension carries `menu-nav-item="<extension>:<id>"` and the extension's markup as of the last save. The copies are rebuilt from the items on every save, so they always match and are never edited. All of these are left out of the Global Content list; use the Menus page, or the menu functions in the [SDK](extensions/sdk.md#menus), to change them.

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
| Menus | `/admin/content/menus` |

## Templating Syntax

Kempo-server templates support:

| Syntax | Purpose |
|---|---|
| `{{variableName}}` | Insert a variable |
| `{{include: fragmentName}}` | Include a fragment |
| `{{location: locationName}}` | Define an injectable location |

See the [kempo-server templating docs](https://github.com/dustinpoissant/kempo-server) for the complete reference.
