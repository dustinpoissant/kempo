# Middleware

## Description
Request interceptors that run before route handlers. Kempo ships two middleware modules: `kempo-auth` for authentication/authorization gating and `extension-scope-router` for serving extension content.

## Dependencies
- kempo-server — middleware signature: `export default (config) => async (request, response, next) => { ... }`
- [Auth](auth.md) — `kempo-auth` uses session and permission utils
- [Extensions](../resources/extensions.md) — `extension-scope-router` queries enabled extensions

## Context
Middleware is registered in `app-public/.config.json` under `middleware.custom`. kempo-server loads and executes them in order before matching route handlers.

### Decisions
- **Config-factory pattern**: Each middleware file exports a function that receives the server config and returns the actual middleware function. This allows middleware to access server settings.
- **Order matters**: `kempo-auth` runs before `extension-scope-router`. Auth must be checked first.
- **Extension scope router is static-only (currently)**: It only serves static files from extension `public/` directories. It does NOT execute route handlers or render templated pages. This is a known limitation that needs to be addressed.

## Implementation

### Location
`middleware/` — registered in `app-public/.config.json` → `middleware.custom`.

### kempo-auth.js
Protects `/account/**` and `/admin/**` routes:
- All protected routes require a valid session (via `session_token` cookie)
- `/admin/**` additionally requires `system:admin:access` permission
- `/admin/pages/edit/**` additionally requires `system:pages:update` permission
- Unauthenticated users are redirected to `/login`
- Unauthorized admin access redirects to `/account`

### extension-scope-router.js
Handles two routing concerns:

**1. Admin extension routing: `/admin/extension/{name}/**`**
- Matched before the enabled-extensions loop; no DB check needed (kempo-auth already protects all `/admin/**` routes)
- Maps to the extension's `admin/` directory in `node_modules`
- Renders `.page.html` files using `renderExternalPage` with `dist/admin/` as the root
- Falls back to static file serving
- Supports scoped packages (`@author/package`)

**2. Public scope routing: `/{scope}/**`**
- Calls `getEnabledExtensions()` from `server/utils/extensions/scopeCache.js` (in-memory cache, invalidated on install/enable/disable/uninstall)
- For each enabled extension, reads its `package.json` from `node_modules` to find `kempo.public-scope`
- If the request URL starts with `/{scope}/`, renders a `.page.html` file from the extension's `public/` directory using `renderExternalPage` with the project's template system
- Falls back to static file serving
- Falls through to `next()` if no extension matches

`pathToRoot` is computed correctly for extension pages by building a virtual `resolveDir` based on URL depth relative to the root.

**Known limitations**:
- Does not execute `.js` route handlers (GET.js, POST.js, etc.)
- Does not support dynamic path parameters (`[id]`)
- Does not support `CATCH.js` fallback handlers

### Config
```json
{
  "middleware": {
    "custom": [
      "../middleware/kempo-auth.js",
      "../middleware/extension-scope-router.js"
    ]
  }
}
```

## Notes
- kempo-server passes `rootPath` to custom middleware via `config.rootPath` so middleware can locate templates.
- The scope router uses `renderExternalPage` from `kempo-server/templating` to render extension pages with the project's template system.
