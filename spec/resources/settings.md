# Settings

## Description
A key-value configuration store for system settings, extension settings, and custom user-defined settings. Settings are typed (string, number, boolean) and can be marked as public (accessible without authentication).

## Dependencies
- [Database](../concepts/db.md) — `setting` table

## Context
Settings provide runtime configuration that can be changed without restarting the server. They replace hardcoded values and environment variables for things that should be configurable through the admin UI.

### Decisions
- **`owner:name` naming convention**: Settings use an owner prefix (e.g., `system:site_name`, `blog:posts_per_page`). The owner indicates who created and manages the setting.
- **Type coercion**: Settings store values as text but have a `type` field (`string`, `number`, `boolean`) for proper conversion on read via the `convertValue` helper.
- **Public settings**: Settings with `isPublic = true` can be fetched without authentication via `GET /kempo/api/settings/public`. Used for frontend configuration like site name.
- **System settings are protected**: The `prevent_system_setting_delete` trigger blocks deletion of settings where `name LIKE 'system:%'`.
- **Name as primary key**: Setting names are unique identifiers.

## Implementation

### Schema
```
setting:
  name        text  PK
  value       text
  type        text  (default 'string')
  isPublic    boolean (default false)
  description text
  createdAt   timestamp
  updatedAt   timestamp
```

### Default Settings (seeded by init-db.js)
| Name | Default | Type | Public | Purpose |
|---|---|---|---|---|
| `system:site_name` | "Kempo Site" | string | Yes | Site display name |
| `system:session_duration_days` | 7 | number | No | Session expiration |
| `system:allow_registration` | true | boolean | Yes | Enable/disable registration |
| `system:require_email_verification` | false | boolean | No | Enforce email verification |
| `system:verification_url` | `http://localhost:3000/verify-email/{{token}}` | string | No | Verification email link template |
| `system:password_reset_url` | `http://localhost:3000/reset-password/{{token}}` | string | No | Password reset email link template |

### Server Utils (`server/utils/settings/`)
| Util | Signature | Purpose |
|---|---|---|
| `getSetting` | `(owner, name, defaultValue)` | Get setting value (type-converted) |
| `getSettingWithMetadata` | `(owner, name)` | Get setting with all fields |
| `getSettingsByOwner` | `(owner)` | Get all settings for an owner |
| `getPublicSettings` | `()` | Get all public settings |
| `listSettings` | `({ owner, limit, offset })` | Paginated list |
| `setSetting` | `(owner, name, value, type, isPublic, description)` | Create or update setting |
| `deleteSetting` | `(owner, name)` | Delete setting (blocked for system) |

### API Routes (`/kempo/api/settings/`)
| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/public` | — | Get all public settings |
| GET | `/[owner]` | `system:settings:read` | List settings by owner |
| GET | `/[owner]/[name]` | `system:settings:read` | Get specific setting |
| POST | `/[owner]/[name]` | `system:settings:update` or `system:custom-settings:manage` | Set setting |
| DELETE | `/[owner]/[name]` | `system:custom-settings:manage` | Delete setting |

### Admin UI
- **List**: `/admin/settings/` — table grouped by owner
- **Editor**: `/admin/settings/[owner]/[name]/` — ValueEditor for editing setting value

## Notes
- Extensions should use their extension name as the `owner` prefix for their settings.
- The `system:custom-settings:manage` permission is for creating/deleting non-system settings; `system:settings:update` is for modifying existing settings.
