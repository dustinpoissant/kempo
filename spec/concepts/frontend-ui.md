# Frontend UI

## Description
The consumer-facing public website, served from the `public/` directory. This is the site that end users visit — not the admin portal and not server-side logic. It is scaffolded from `app-public/` during `npx kempo init` and is entirely owned by the developer after that.

## Dependencies
- kempo-server — serves and renders the files in `public/`
- [Pages](../resources/pages.md), [Templates](../resources/templates.md), [Fragments](../resources/fragments.md), [Global Content](../resources/global-content.md) — the content system that powers the site

## Context
Kempo provides a starting point (`app-public/`) that gets copied to the consumer's `public/` directory. From there, the developer owns it completely. The site can be built with plain HTML, kempo-ui web components, or any framework that outputs HTML (React with SSR, Svelte, etc.) as long as the output ends up in `public/`.

### Decisions
- **Framework-agnostic**: The public site is just files in a directory. Any toolchain that produces HTML, CSS, and JS there works. kempo does not impose a frontend framework.
- **Starter scaffold, not a lock-in**: `app-public/` is a starting point with a working login/register/account flow, default template, and nav fragment. The developer replaces or extends it as needed.
- **kempo-server serves it**: kempo-server handles routing, SSR templating, and static file serving for everything in `public/`. Custom routes and middleware are configured in `public/.config.json`.
- **kempo-ui components are optional**: The starter scaffold uses kempo-ui components (`<k-permission>`, `<k-menu>`, etc.) for convenience, but they are not required.

## Implementation

### Location
`app-public/` — copied to the consumer's `public/` during `npx kempo init`.

### Starter Content
| Path | Purpose |
|---|---|
| `.config.json` | kempo-server config (routes, middleware, templating) |
| `default.template.html` | Default page layout |
| `split.template.html` | Split-layout variant |
| `index.page.html` | Homepage |
| `nav.fragment.html` | Site navigation |
| `kempo-global.global.html` | Site-wide global content entries |
| `styles.css` | Consumer stylesheet |
| `init.js` | Sets icon paths, loads any global components |
| `login/`, `register/` | Auth pages |
| `account/` | Authenticated account page |
| `forgot-password/`, `reset-password/[token]/` | Password reset flow |
| `verify-email/[token]/` | Email verification flow |

## Notes
- The auth pages (login, register, etc.) are part of the starter and use kempo's API and components, but the developer can replace them with any implementation.
- Build pipelines (e.g., Vite, Next.js export, SvelteKit static) just need to output their result into `public/` for kempo-server to serve it.
