---
name: create-page
description: Creates a new page file for the kempo project using the kempo-server templating system.
applyTo: "dist/**/*.page.html"
---

# Create Page

## When to Use

Use this skill any time a new `.page.html` file is being created — whether for the admin panel or the consumer-facing site.

## Reference

Full templating documentation: https://dustinpoissant.github.io/kempo-server/templating.html

## File Naming Convention

**Always use `pageName/index.page.html`, NEVER `pageName.page.html`.**

- `dist/admin/pages/index.page.html` — correct
- `dist/admin/pages.page.html` — wrong

Both resolve to the same URL (`/admin/pages`), but the subdirectory form is preferred because it keeps related sub-pages (e.g. `pages/edit/index.page.html`) grouped together.

## Page Structure

A page file wraps content in a `<page>` root element and uses `<content>` blocks to fill template locations:

```html
<page title="Page Title">
	<content>
		<!-- default location content -->
	</content>
</page>
```

### Page Attributes

Attributes on the `<page>` tag become template variables. The special `template` attribute selects which template to use (defaults to `default`).

```html
<page template="blog" title="My Post" author="Dustin">
	<content>...</content>
</page>
```

### Named Content Locations

Use `<content location="name">` to target specific template slots:

```html
<page title="My Page">
	<content>
		<p>Main content (targets "default" location)</p>
	</content>
	<content location="scripts">
		<script type="module" src="/my-script.js"></script>
	</content>
</page>
```

## Admin Pages

Admin pages use the `default` template at `dist/admin/default.template.html` which provides:

- `<location />` — default content area (inside `<k-main>`)
- `<location name="head" />` — extra `<head>` content
- `<location name="scripts" />` — scripts before `</body>`

The admin nav fragment is automatically included via the template.
