# Groups

## Description
Role groups that organize users and grant permissions. Users are assigned to groups, and groups are assigned permissions. A user's effective permissions are the union of all permissions from all their groups.

## Dependencies
- [Database](../concepts/db.md) — `group`, `userGroup`, `groupPermission` tables
- [Users](users.md) — groups contain users
- [Permissions](permissions.md) — groups are assigned permissions

## Context
Groups are the middle layer of the access control system: Users → Groups → Permissions. This allows managing access by role rather than per-user.

### Decisions
- **Name as primary key**: Group names are unique identifiers (e.g., `system:Administrators`). This makes them human-readable in the DB and avoids extra lookups.
- **`owner` field**: Distinguishes system groups (`owner = 'system'`) from user-created groups (`owner = 'user'`) and extension-created groups. System groups are protected by a database trigger.
- **Two default groups**: `system:Users` (all registered users) and `system:Administrators` (full access). These are seeded by `init-db.js`.
- **System groups cannot be deleted**: The `prevent_system_group_delete` trigger blocks deletion of groups where `owner = 'system'`.

## Implementation

### Schema
```
group:
  name        text  PK
  description text
  owner       text  (default 'user')
  createdAt   timestamp

userGroup:
  id          text  PK (UUID)
  userId      text  FK → user.id
  groupName   text  FK → group.name
  createdAt   timestamp
```

### Server Utils (`server/utils/groups/`)
| Util | Signature | Purpose |
|---|---|---|
| `createGroup` | `({ name, description, owner })` | Create a group |
| `deleteGroup` | `(name)` | Delete a group (blocked for system groups) |
| `getGroup` | `(name)` | Get group by name |
| `listGroups` | `({ limit, offset, owner })` | Paginated group list |
| `updateGroup` | `(name, updates)` | Update group fields |
| `addUserToGroup` | `(userId, groupName)` | Add user to group |
| `removeUserFromGroup` | `(userId, groupName)` | Remove user from group |
| `getGroupMembers` | `(groupName, { limit, offset })` | List group members |

### API Routes (`/kempo/api/groups/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:group:read` | List groups |
| POST | `/` | `system:group:create` | Create group |
| PATCH | `/` | `system:group:update` | Update group |
| DELETE | `/` | `system:group:delete` | Delete groups |
| GET | `/[name]` | `system:group:read` | Get group |
| GET | `/[name]/members` | `system:group:read` | List members |
| POST | `/[name]/members` | `system:group:update` | Add member |
| DELETE | `/[name]/members` | `system:group:update` | Remove member |
| GET | `/[name]/permissions` | `system:group:read` | List group permissions |

### Admin UI
- **List**: `/admin/accounts/groups/` — table with create, delete, link to detail
- **Detail**: `/admin/accounts/groups/[name]/` — members list, permissions list, add/remove controls

## Notes
- The admin UI protects the `system:Users` group from deletion in the `GroupDeleteSelected` table control.
- Extensions can create their own groups with a custom `owner` value.
