# Middleware

## Description
Request interceptors that run before route handlers. Kempo ships one middleware module, `middleware/kempo.js`, which gates `/admin/**` and `/account/**` behind a session and permissions, serves extensions' `admin/` and `public/` directories, and starts the scheduler.

## Dependencies
- kempo-server — middleware signature: `export default (config) => async (request, response, next) => { ... }`
- [Auth](auth.md) — it uses session and permission utils
- [Extensions](../resources/extensions.md) — it queries the enabled extensions for their scopes and aliases

## Context
Middleware is registered in the server config (`app-public/.config.json`) under `middleware`. kempo-server loads and runs them in order before matching route handlers.

### Decisions
- **Config-factory pattern**: the file exports a function that receives the server config and returns the middleware function, so it can read server settings (`middleware.adminRoot`).
- **One file**: authentication and extension serving are in the same module. The older `kempo-auth` and `extension-scope-router` files were unused and have been removed.
- **Extensions are served fully**: `.page.html` templates are rendered, route handlers (`GET.js`, `POST.js`, ..., `CATCH.js`) run with `(request, response)`, `[param]` directories fill `request.params`, and anything else is served as a static file with its MIME type.

## Implementation

### Location
`middleware/kempo.js`, registered as `"../node_modules/kempo/middleware/kempo.js"`.

### Authentication
- `/account/**` and `/admin/**` need a valid session (the `session_token` cookie).
- `/admin/**` also needs `system:admin:access`.
- Unauthenticated users are redirected to `/login`; an authenticated user without admin access is sent to `/account`.

### Extension routing
- **Admin**: `/admin/extension/{name}/**` maps to the extension's `admin/` directory. Supports scoped packages (`@author/package`).
- **Public**: `/{scope}/**` maps to the `public/` directory of the enabled extension that claims that scope (`public-scope`, or `public-scopes` for several folders). The enabled extensions are cached in memory and invalidated on install, enable, disable and uninstall. When the file is not in the extension, the request falls through to the site's own pages.
- **Aliases**: an extension's `aliases` map extra addresses onto its files.

### Config
```json
{
  "middleware": [
    "../node_modules/kempo/middleware/kempo.js"
  ]
}
```
