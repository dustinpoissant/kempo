# Permissions

## Description
Granular access control definitions that are assigned to groups. Permission names follow the pattern `system:resource:action`. Checking is done via session token or user ID.

## Dependencies
- [Database](../concepts/db.md) — `permission`, `groupPermission` tables
- [Groups](groups.md) — permissions are assigned to groups

## Context
Permissions are the leaf nodes of the access control system. They are checked in API routes, middleware, and frontend components to control who can do what.

### Decisions
- **Name as primary key**: Permission names like `system:pages:update` are the identifier. Colon-separated convention: `{owner}:{resource}:{action}`.
- **`owner` field**: Distinguishes system permissions from extension-created ones. System permissions are protected by a database trigger.
- **Checked via session token**: The `currentUserHasPermission(token, name)` pattern resolves the user from the session, gets their groups, and checks if any group has the permission. This avoids passing user IDs around in the HTTP layer.
- **31 default permissions**: Seeded by `init-db.js` covering all system resources.

## Implementation

### Schema
```
permission:
  name        text  PK
  description text
  owner       text  (default 'user')
  createdAt   timestamp

groupPermission:
  id              text  PK (UUID)
  groupName       text  FK → group.name
  permissionName  text  FK → permission.name
  createdAt       timestamp
```

### Default Permissions
| Category | Permissions |
|---|---|
| Users | `system:user:create`, `system:user:read`, `system:user:update`, `system:user:delete` |
| Groups | `system:group:create`, `system:group:read`, `system:group:update`, `system:group:delete` |
| Permissions | `system:permissions:read`, `system:permissions:manage` |
| Settings | `system:settings:read`, `system:settings:update`, `system:custom-settings:manage` |
| Pages | `system:pages:read`, `system:pages:create`, `system:pages:update`, `system:pages:delete` |
| Menus | `system:menus:create`, `system:menus:read`, `system:menus:update`, `system:menus:delete` |
| Fragments | `system:fragments:read`, `system:fragments:create`, `system:fragments:update`, `system:fragments:delete` |
| Globals | `system:globals:read`, `system:globals:create`, `system:globals:update`, `system:globals:delete` |
| Extensions | `system:extensions:read`, `system:extensions:install`, `system:extensions:uninstall`, `system:extensions:manage` |
| Admin | `system:admin:access` |

### Server Utils (`server/utils/permissions/`)
| Util | Purpose |
|---|---|
| `createPermission({ resource, action, description, owner })` | Create a permission |
| `deletePermission(name)` | Delete (blocked for system) |
| `getAllPermissions({ limit, offset, owner })` | List permissions |
| `updatePermission(name, updates)` | Update description |
| `currentUserHasPermission(token, name)` | Check via session token |
| `currentUserHasAllPermissions(token, names)` | Check all via token |
| `currentUserHasSomePermissions(token, names)` | Check any via token |
| `userHasPermission(userId, name)` | Check via user ID |
| `userHasAllPermissions(userId, names)` | Check all via user ID |
| `userHasSomePermissions(userId, names)` | Check any via user ID |
| `getUserPermissions(userId)` | Get all user permissions |
| `getUserPermission(userId, name)` | Get specific permission |
| `getUserGroups(userId)` | Get user's groups |
| `getPermissionsForGroups(groups)` | Get permissions for group list |

### API Routes (`/kempo/api/permissions/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:permissions:read` | List permissions |
| POST | `/` | `system:permissions:manage` | Create permissions |
| PATCH | `/` | `system:permissions:manage` | Update permission |
| DELETE | `/` | `system:permissions:manage` | Delete permissions |

### Admin UI
- **List**: `/admin/accounts/permissions/` — table with create, delete

## Notes
- Extensions register their own permissions during installation. These are cleaned up on uninstall.
- The `system:Administrators` group gets ALL permissions by default.
