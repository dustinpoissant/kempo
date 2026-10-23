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

Pass the **real value**, not a serialised one — `setSetting` serialises it according to `type`. For
`json` that means handing it the array or object itself; a string containing JSON would be encoded a
second time and read back as text. (Declarative settings in `kempo-config.json` may use either form;
kempo parses a JSON string there before storing it.)

## Secret Settings

`type: 'secret'` is for values that should never be readable by anyone but the server — API keys,
webhook signing secrets, OAuth client secrets:

```javascript
await setSetting('my-ext', 'stripe_secret_key', 'sk_live_...', 'secret', false, 'Stripe API key');
```

- It's encrypted at rest with AES-256-GCM, with the key in `SETTINGS_ENCRYPTION_KEY` (a 64-character hex
  string, i.e. 32 bytes). You do not have to make one: when the server starts without it, kempo
  generates one and saves it to the site's `.env` (owner-only; `.env` is added to `.gitignore` when there
  is one), and `npx kempo init` writes one into the `.env` it creates. Anyone with shell access to the
  server can read it there.
  - **Back it up with the database.** Losing it makes every stored secret unreadable. Nothing else is
    lost; the credentials can be typed in again.
  - **It is never replaced.** When the database already holds encrypted settings and no key is set, kempo
    does not make a new one (it would orphan them). It logs an error saying so and secrets stay
    unavailable until the original key is restored.
  - **A key you set always wins.** Put `SETTINGS_ENCRYPTION_KEY` in the environment or a secret manager
    when you run more than one server (each would otherwise make its own) or on a host whose disk is
    wiped on deploy. Turn generation off with `KEMPO_AUTO_ENCRYPTION_KEY=off`, or `autoEncryptionKey: false`
    in the server config.
- `isPublic` is forced to `false` no matter what you pass — a secret can never be exposed through
  `getPublicSettings`.
- `getSetting`/`getSettingsByOwner` still return the real decrypted value, since server-side code
  (e.g. calling the Stripe API) needs it. Nothing else does: `getSettingWithMetadata` and
  `listSettings` — the two paths that feed the admin panel's HTTP API — return the literal string
  `••••••••` in place of the value, never the ciphertext or the plaintext.
- Editing one in the admin panel is replace-only: leaving the field blank keeps the existing secret;
  typing a new value replaces it. There is no way to view a previously-saved secret again.

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
| `system:email_max_retries` | 1 | number | No | How many times a failed email is tried again after the first try (0 never retries) |
| `system:email_retention_days` | 30 | number | No | Days the email log is kept (0 keeps it forever) |
| `system:email_retention_by_type` | {} | json | No | Days to keep a kind of email instead, like `{ "verify-email": 7 }` (0 keeps that kind forever) |
| `system:email_from` | "" | string | No | The address emails are sent from (`name@example.com` or `Shop Name <name@example.com>`, on a domain verified with the email provider). Empty uses `EMAIL_FROM` from the environment. Checked when saved |

Settings added in a later version of kempo are added to an older site, with their defaults, when the server starts. Only missing ones are added; nothing already there is changed.

## Admin Panel

Settings are managed at `/admin/settings`, in tabs:

- **Custom**: the site's own settings. Create one with **Create a setting** (name, type, value, description, public), and delete one with its trash button.
- **System**: kempo's own settings.
- Then a tab for each extension that chooses to add one (see [Settings tabs](extensions/creating-extensions.md#settings-tabs)). An extension that does not add a tab has nothing on this page and manages its own settings wherever it likes.

Every setting is edited with the editor for its **type**, under a readable name made from the setting name (`session_duration_days` is "Session Duration Days", `verification_url` is "Verification URL") and its description as a hint:

| Type | Editor |
|---|---|
| `string` | A text field (a larger box for a long value or one with several lines) |
| `number` | A number field; text that is not a number cannot be saved |
| `boolean` | A toggle |
| `json` | A box with the formatted JSON; text that is not JSON cannot be saved |
| `secret` | A password field, replace-only: the saved value is never shown, and an empty field keeps it |

Press **Save settings** to save what was changed on that tab (only the changed settings are sent). Who can change what is unchanged: `system:settings:update` for System, `system:custom-settings:manage` for Custom and `system:extensions:manage` for an extension's settings; without it the fields are read-only. The type, whether a setting is public and its description are edited on the setting's own page, `/admin/settings/<owner>/<name>/`.

## Creating App Settings

You can create your own settings for runtime configuration. Use your app name as the owner prefix to avoid conflicts:

```javascript
import setSetting from 'kempo/server/utils/settings/setSetting.js';

// Run this in an init script or migration
await setSetting('myapp', 'posts_per_page', 10, 'number', true, 'Number of posts per page');
```

Settings created this way appear in the admin panel and can be edited by anyone with `system:custom-settings:manage` permission.
