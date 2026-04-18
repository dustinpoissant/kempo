# API

## Description
RESTful API routes served at `/kempo/api/` using kempo-server's file-based routing. Each route is a `[METHOD].js` file that exports an async handler receiving `(request, response)`. Routes are permission-gated and delegate to server utils.

## Dependencies
- [Server Utils](server-utils.md) — routes call utils for business logic
- [Permissions](../resources/permissions.md) — routes check permissions before proceeding
- kempo-server — provides the file-based routing, request parsing, and response API

## Context
The API layer is the HTTP boundary. It extracts data from requests (body, query, cookies, params), calls server utils, and formats responses. It never contains business logic itself.

### Decisions
- **File-based routing**: Route structure mirrors URL paths. `dist/kempo/api/users/[id]/GET.js` handles `GET /kempo/api/users/:id`.
- **Method files**: Each HTTP method is a separate file (`GET.js`, `POST.js`, `PUT.js`, `PATCH.js`, `DELETE.js`).
- **Dynamic segments**: Directory names wrapped in brackets (`[id]`, `[name]`, `[owner]`) become `request.params` values.
- **CATCH.js**: Fallback handlers for unmatched sub-routes within a directory.
- **Permission gating**: Most routes check `currentUserHasPermission(token, 'system:resource:action')` before processing.
- **Request body**: Eagerly parsed by kempo-server based on `Content-Type` — JSON bodies are parsed objects, form data is parsed via URLSearchParams, others are raw strings.

## Implementation

### Location
`dist/kempo/api/` — mapped to `/kempo/api/**` via `.config.json` custom routes.

### Route Handler Pattern
```javascript
import currentUserHasPermission from '../../../../server/utils/permissions/currentUserHasPermission.js';
import someUtil from '../../../../server/utils/resource/someUtil.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [permError, hasPermission] = await currentUserHasPermission(token, 'system:resource:action');
  if(permError) return response.status(permError.code).json({ error: permError.msg });
  if(!hasPermission) return response.status(403).json({ error: 'Insufficient permissions' });

  const { id } = request.body;
  const [error, result] = await someUtil({ id });
  if(error) return response.status(error.code).json({ error: error.msg });
  response.json(result);
};
```

### API Surface
| Resource | Base Path | Methods |
|---|---|---|
| Auth | `/kempo/api/auth/` | login, logout, register, session, verify-email, change-password, reset-password |
| Users | `/kempo/api/user/` | CRUD, groups, permissions, sessions |
| Groups | `/kempo/api/groups/` | CRUD, members, permissions |
| Permissions | `/kempo/api/permissions/` | CRUD |
| Settings | `/kempo/api/settings/` | public, by-owner, get/set/delete |
| Pages | `/kempo/api/pages/` | CRUD, directories, templates, file get/update/move |
| Templates | `/kempo/api/templates/` | CRUD, file get/update |
| Fragments | `/kempo/api/fragments/` | CRUD, file get/update |
| Global Content | `/kempo/api/globals/` | CRUD, entry get/update |
| Menus | `/kempo/api/menus/` | CRUD, items, by-slug |
| Extensions | `/kempo/api/extensions/` | list, install, uninstall, enable, disable, available, known, update, update-check |
| Admin Globals | `/kempo/api/admin-globals/` | CRUD, enable, disable |
| Forgot Password | `/kempo/api/forgot-password/` | POST |

## Notes
- Auth routes do not require permission checks (they establish identity).
- The `forgot-password` route is at the top level rather than under `auth/` — this may be an inconsistency to address.
