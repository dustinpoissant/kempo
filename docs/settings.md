# Settings

Settings are typed key-value pairs stored in the database. They're used for runtime configuration that can be changed through the admin panel without restarting the server.

## Naming Convention

Setting names follow the pattern `owner:name`. The `owner` groups related settings and indicates who manages them:

- `system:site_name` — a built-in kempo setting
- `blog:recent_limit` — a setting created by the kempo-blog extension
- `myapp:feature_flag` — a setting you create in your app

## Reading Settings

```javascript
import getSetting from 'kempo/server/utils/settings/getSetting.js';

// Returns the value converted to the setting's type, or defaultValue if not found
const limit = await getSetting('blog', 'recent_limit', 5);
```

## Writing Settings

```javascript
import setSetting from 'kempo/server/utils/settings/setSetting.js';

// setSetting(owner, name, value, type, isPublic, description)
const [error] = await setSetting('myapp', 'feature_flag', true, 'boolean', false, 'Enable the new feature');
```

`setSetting` creates the setting if it doesn't exist, or updates the value if it does.

## Public Settings

Settings marked `isPublic = true` are accessible from the browser without authentication:

```javascript
// GET /kempo/api/settings/public
const res = await fetch('/kempo/api/settings/public');
const settings = await res.json();
console.log(settings['system:site_name']); // "My Site"
```

## Default Settings

| Name | Default | Type | Public | Purpose |
|---|---|---|---|---|
| `system:site_name` | "Kempo Site" | string | Yes | Site display name |
| `system:session_duration_days` | 7 | number | No | Session token lifetime in days |
| `system:allow_registration` | true | boolean | Yes | Allow new user registrations |
| `system:require_email_verification` | false | boolean | No | Require verified email to log in |

## Admin Panel

Settings are managed at `/admin/settings`, grouped by owner. Each setting has an editor appropriate for its type.

## Creating App Settings

You can create your own settings for runtime configuration. Use your app name as the owner prefix to avoid conflicts:

```javascript
import setSetting from 'kempo/server/utils/settings/setSetting.js';

// Run this in an init script or migration
await setSetting('myapp', 'posts_per_page', 10, 'number', true, 'Number of posts per page');
```

Settings created this way appear in the admin panel and can be edited by anyone with `system:custom-settings:manage` permission.
