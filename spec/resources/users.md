# Users

## Description
User accounts with email/password authentication, profile data, and email verification status. Users are assigned to groups which grant permissions.

## Dependencies
- [Database](../concepts/db.md) — `user` table
- [Auth](../concepts/auth.md) — registration, login, verification flows
- [Groups](groups.md) — users are assigned to groups via `userGroup` join table
- [Sessions](sessions.md) — users have active sessions

## Context
Users are the core identity entity. Every authenticated action in the system traces back to a user through their session. The user table stores account data; authorization is handled through groups and permissions.

### Decisions
- **Email as unique identifier**: Email is the login credential and must be unique.
- **UUID primary keys**: User IDs are UUIDs generated in application code.
- **Password hashing**: Passwords are hashed with bcrypt before storage. The raw password is never stored.
- **Soft email verification**: `emailVerified` is a boolean flag. Whether it's enforced depends on the `system:require_email_verification` setting.
- **All new users join `system:Users` group**: On registration, users are automatically added to the default user group.

## Implementation

### Schema
```
user:
  id          text  PK (UUID)
  name        text
  email       text  UNIQUE
  passwordHash text
  emailVerified boolean (default false)
  createdAt   timestamp
  updatedAt   timestamp
```

### Server Utils (`server/utils/users/`)
| Util | Signature | Purpose |
|---|---|---|
| `createUser` | `({ name, email, password, emailVerified })` | Create account with hashed password |
| `deleteUser` | `(id)` | Delete user by ID |
| `getUserById` | `(id)` | Get user by ID |
| `getUserByEmail` | `(email)` | Get user by email |
| `getUsers` | `({ limit, offset })` | Paginated user list |
| `updateUser` | `(id, updates)` | Update user fields |
| `findUsersByEmail` | `(searchTerm, { limit, offset })` | Search users by email |
| `findUsersByName` | `(searchTerm, { limit, offset })` | Search users by name |

### API Routes (`/kempo/api/user/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/` | `system:user:read` | List users |
| POST | `/create` | `system:user:create` | Create user |
| PATCH | `/` | `system:user:update` | Update user |
| DELETE | `/` | `system:user:delete` | Delete users |
| GET | `/[userid]` | `system:user:read` | Get user by ID |
| GET | `/[userid]/groups` | `system:user:read` | Get user's groups |
| POST | `/[userid]/groups` | `system:group:update` | Add user to group |
| DELETE | `/[userid]/groups` | `system:group:update` | Remove user from group |
| GET | `/[userid]/sessions` | `system:user:read` | Get user sessions |
| DELETE | `/[userid]/sessions` | `system:user:update` | Delete user session |
| DELETE | `/[userid]/sessions/expired` | `system:user:update` | Clear expired sessions |
| GET | `/[userid]/permissions` | — | Check user permission |
| GET | `/[userid]/permissions/all` | — | Check all permissions |
| GET | `/[userid]/permissions/some` | — | Check some permissions |
| GET | `/[userid]/permissions/list` | — | List user permissions |

### Admin UI
- **List**: `/admin/accounts/users/` — table with search, delete, link to detail
- **Detail**: `/admin/accounts/users/[id]/` — user info, groups, sessions

## Notes
- Deleting a user cascades to sessions, verification tokens, and user-group memberships via application logic (not DB cascades).
