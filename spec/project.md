# Kempo

## Description
A fullstack CMS framework for creating websites and APIs with user authentication, role-based access control, content management, and an extensible plugin system. Built on top of kempo-server, kempo-ui, and kempo-css. Installed via `npm install kempo` and scaffolded with `npx kempo init`.

## Dependencies

### [kempo-server](https://raw.githubusercontent.com/dustinpoissant/kempo-server/refs/heads/main/llms.txt)
A file-based routing system that handles the following:
- Server config
- Routing (file-based with `[METHOD].js` handlers, dynamic `[param]` segments, `CATCH.js` fallbacks)
- Template system (SSR with `.page.html`, `.template.html`, `.fragment.html`, `.global.html`)

### [kempo-ui](https://raw.githubusercontent.com/dustinpoissant/kempo-ui/refs/heads/main/llm.txt)
A frontend component library based on Lit. Provides `ShadowComponent`, `LightComponent`, `HybridComponent`, `TableControl`, and ready-made components like `<k-table>`, `<k-aside>`, `<k-main>`, `<k-icon>`, `<k-import>`.

### [kempo-css](https://raw.githubusercontent.com/dustinpoissant/kempo-css/refs/heads/main/llms.txt)
A CSS framework that styles native HTML elements by default — a plain `<button>` gets button styles without any class. Utility classes are also provided for cases where the default element styles don't apply (e.g., adding `.btn` to an `<a>` to make it look like a button). Other utility classes are avialable for borders, spacing, colors, ect.
 
## Concepts

Architectural patterns and cross-cutting systems.

- [Database](concepts/db.md) — PostgreSQL schema, Drizzle ORM, migrations, triggers, seeding
- [Auth](concepts/auth.md) — Authentication and session management flow
- [Server Utils](concepts/server-utils.md) — HTTP-agnostic backend logic with error tuple returns
- [Server SDK](concepts/server-sdk.md) — Single-import re-export of all server utils, mostly for use by extensions
- [API](concepts/api.md) — RESTful file-based API routes with permission gating
- [Middleware](concepts/middleware.md) — Request interceptors for auth and extension routing
- [Frontend SDK](concepts/frontend-sdk.md) — Browser-side SDK with deduplicating fetch
- [Frontend UI](concepts/frontend-ui.md) — Consumer-facing public website (scaffolded from app-public/)
- [Admin UI](concepts/admin-ui.md) — Admin portal with tables, editors, and navigation
- [Email](concepts/email.md) — Transactional email via Resend with kempo-server templating
- [CLI](concepts/cli.md) — Project scaffolding via `npx kempo init`
- [Build](concepts/build.md) — Minification and optimization of source files for distribution

## Resources

Data entities managed by the CMS.

- [Users](resources/users.md) — User accounts with email/password auth
- [Sessions](resources/sessions.md) — Auth session tokens with expiration
- [Groups](resources/groups.md) — Role groups for organizing users
- [Permissions](resources/permissions.md) — Granular access control definitions
- [Settings](resources/settings.md) — Key-value configuration store
- [Pages](resources/pages.md) — CMS content pages with templates
- [Templates](resources/templates.md) — HTML page layouts with locations
- [Fragments](resources/fragments.md) — Reusable HTML snippets
- [Global Content](resources/global-content.md) — HTML injected into template locations
- [Hooks](resources/hooks.md) — Event callbacks registered by extensions
- [Extensions](resources/extensions.md) — Plugin system with hooks and scoped routes


