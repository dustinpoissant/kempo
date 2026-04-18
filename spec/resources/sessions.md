# Sessions

## Description
Authentication session tokens stored in the database with expiration timestamps, IP addresses, and user agent strings. Sessions tie a browser cookie to a user identity and are the foundation for all authenticated operations.

## Dependencies
- [Database](../concepts/db.md) — `session` table
- [Users](users.md) — each session belongs to a user

## Context
Sessions are created on login and destroyed on logout. They are stored server-side in the database (not JWTs) so they can be individually revoked, listed, and cleaned up.

### Decisions
- **Token as primary key**: Session tokens are random strings used as both the database key and the cookie value.
- **Database-stored**: Sessions live in the DB, not in JWTs or memory. This enables listing active sessions, revoking specific sessions, and surviving server restarts.
- **Cookie-based**: The session token is sent to the browser as an HTTP-only `session_token` cookie.
- **Configurable expiration**: Session duration is controlled by the `system:session_duration_days` setting (default: 7 days).
- **IP and user agent tracking**: Sessions store the client's IP address and user agent for security auditing in the admin panel.
- **Expired session cleanup**: Expired sessions are cleaned up on login and can be manually purged via the admin UI.

## Implementation

### Schema
```
session:
  token       text  PK
  userId      text  FK → user.id
  expiresAt   timestamp
  createdAt   timestamp
  ipAddress   text
  userAgent   text
```

### Server Utils (`server/utils/sessions/`)
| Util | Signature | Purpose |
|---|---|---|
| `createSession` | `(userId)` | Create session with expiration |
| `getSessionById` | `(token)` | Get session by token |
| `getSessionByToken` | `(token)` | Get session by token (alias) |
| `getSessions` | `({ limit, offset })` | List all sessions |
| `getUserSessions` | `(userId, { limit, offset })` | List user's sessions |
| `deleteSession` | `(token)` | Delete specific session |
| `deleteUserSessions` | `(userId)` | Delete all user sessions |
| `deleteExpiredUserSessions` | `(userId)` | Clean up expired sessions |

### API Routes
Sessions are managed through user endpoints (`/kempo/api/user/[userid]/sessions/`):
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/[userid]/sessions` | `system:user:read` | List user sessions |
| DELETE | `/[userid]/sessions` | `system:user:update` | Delete specific session |
| DELETE | `/[userid]/sessions/expired` | `system:user:update` | Clear expired sessions |

### Admin UI
Sessions are shown in the user detail page (`/admin/accounts/users/[id]/`) with a table and a "Clear Expired Sessions" control.

## Notes
- The `getSession` auth util (in `server/utils/auth/`) combines session lookup with user data for middleware use. The session utils in `server/utils/sessions/` are lower-level CRUD operations.
- There is no dedicated "sessions" admin page — sessions are managed per-user.
