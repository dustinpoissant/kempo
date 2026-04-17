# Kempo

A fullstack CMS framework for creating websites with user authentication, group-based permissions, and an admin panel. Built on [kempo-server](https://github.com/dustinpoissant/kempo-server), [kempo-css](https://github.com/dustinpoissant/kempo-css), and [kempo-ui](https://github.com/dustinpoissant/kempo-ui).

## Quick Start

```bash
npx kempo init
```

This initializes the current directory with everything scaffolded:

| File / Directory | Purpose |
|---|---|
| `package.json` | Pre-configured with start script |
| `.env` | Environment variables template |
| `.gitignore` | Ignores `node_modules` and `.env` |
| `docker-compose.yml` | PostgreSQL database via Docker |
| `public/` | Your website's pages, assets, and route handlers |
| `public/.config.json` | Server routing and middleware config |
| `server/db/schema.js` | Your app's database table definitions |
| `drizzle.config.js` | Drizzle ORM config (points to both your schema and kempo's) |

These files are yours to modify. Kempo will not overwrite them on future installs.

### Setup the Database

Update the credentials in `.env` and `docker-compose.yml` if needed, then:

```bash
docker compose up -d
npx drizzle-kit push
node node_modules/kempo/scripts/init-db.js
```

### Start the Server

```bash
npm start
```

Your site is running at `http://localhost:3000`.

### Create an Admin User

Register a user through the UI at `/register`, then promote them:

```bash
node node_modules/kempo/scripts/make-admin.js
```

This prompts for the user's email and adds them to the `system:Administrators` group. To remove admin access:

```bash
node node_modules/kempo/scripts/remove-admin.js
```

## Scaffolded Pages

Kempo scaffolds these pages into your `public/` directory. All are fully functional and customizable.

| Route | Page |
|---|---|
| `/` | Home page |
| `/login` | Login form |
| `/register` | Registration form |
| `/forgot-password` | Password recovery |
| `/reset-password/[token]` | Password reset (from email link) |
| `/verify-email` | Email verification notice |
| `/verify-email/[token]` | Email verification (from email link) |
| `/account` | User account page (requires login) |
| `/admin` | Admin dashboard (requires `system:admin:access` permission) |
| `/admin/accounts/users` | User management |
| `/admin/accounts/users/create` | Create user |
| `/admin/accounts/users/[id]` | Edit user |
| `/admin/accounts/groups` | Group management |
| `/admin/accounts/permissions` | Permission management |
| `/admin/settings` | Settings management |

## Project Structure

After setup, your project looks like this:

```
my-site/
├── .env
├── drizzle.config.js        # Drizzle config (your schema + kempo's)
├── package.json
├── public/                   # Your website
│   ├── .config.json          # Server routing & middleware config
│   ├── index.html            # Home page
│   ├── styles.css            # Your custom styles
│   ├── login/
│   ├── register/
│   ├── account/
│   ├── admin/
│   └── ...
├── server/
│   └── db/
│       └── schema.js         # Your app's database tables
└── node_modules/
    └── kempo/
        ├── dist/kempo/       # SDK, API endpoints, components
        ├── server/
        │   ├── db/schema.js  # Framework tables (user, session, group, etc.)
        │   └── utils/        # Backend utilities
        ├── middleware/        # Auth middleware
        └── templates/         # Nav and email templates
```

## Custom Database Tables

Define your app's tables in `server/db/schema.js`. You can reference kempo's tables for foreign keys:

```javascript
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from 'kempo/server/db/schema.js';

export const post = pgTable('post', {
  id: text('id').primaryKey(),
  authorId: text('authorId').references(() => user.id),
  title: text('title').notNull(),
  content: text('content'),
  createdAt: timestamp('createdAt').notNull(),
});
```

Then push to the database:

```bash
npx drizzle-kit push
```

Your `drizzle.config.js` already points to both schema files, so both framework and app tables are managed together.

### Querying the Database

Import the shared database instance from kempo:

```javascript
import db from 'kempo/server/db/index.js';
import { post } from '../../db/schema.js';

export default async ({ authorId, title, content }) => {
  const result = await db.insert(post).values({
    id: crypto.randomUUID(),
    authorId,
    title,
    content,
    createdAt: new Date(),
  }).returning();

  return [null, result[0]];
};
```

## Framework Database Tables

Kempo provides these tables out of the box:

| Table | Purpose |
|---|---|
| `user` | User accounts (id, name, email, passwordHash, emailVerified, timestamps) |
| `session` | Login sessions (token, userId, expiresAt, ipAddress, userAgent) |
| `verificationToken` | Email verification and password reset tokens |
| `group` | Permission groups (e.g. `system:Users`, `system:Administrators`) |
| `userGroup` | User-to-group membership |
| `permission` | Named permissions (e.g. `system:admin:access`) |
| `groupPermission` | Group-to-permission assignments |
| `setting` | Key-value settings with type, visibility, and ownership |

## Frontend SDK

Kempo provides a client-side SDK at `/kempo/sdk.js` for calling API endpoints.

```html
<script type="module">
  import { login, getSession, logout } from '/kempo/sdk.js';

  const [error, result] = await login({ email: 'user@example.com', password: 'secret' });
  if(error){
    console.error(error.msg);
  }
</script>
```

All SDK methods return an `[error, data]` tuple. On failure, `error` is `{ code, msg }`. On success, `error` is `null`.

### Auth

| Method | Parameters |
|---|---|
| `register` | `{ email, password, name }` |
| `login` | `{ email, password }` |
| `logout` | (none) |
| `getSession` | (none) |
| `forgotPassword` | `{ email }` |
| `resetPassword` | `{ token, password, logoutAll? }` |
| `changePassword` | `{ currentPassword, newPassword, logoutAll? }` |
| `verifyEmail` | `{ token }` |

### Permissions

| Method | Parameters |
|---|---|
| `currentUserHasPermission` | `{ permission }` |
| `currentUserHasAllPermissions` | `{ permissions }` |
| `currentUserHasSomePermissions` | `{ permissions }` |
| `getAllCurrentUserPermissions` | (none) |
| `userHasPermission` | `{ userid, permission }` |
| `userHasAllPermissions` | `{ userid, permissions }` |
| `userHasSomePermissions` | `{ userid, permissions }` |
| `getAllUserPermissions` | `{ userid }` |

### Users

| Method | Parameters |
|---|---|
| `getUsers` | `{ limit?, offset? }` |
| `getUser` | `userid` |
| `createUser` | `{ name, email, password, emailVerified? }` |
| `updateUser` | `{ id, name?, email?, emailVerified?, createdAt? }` |
| `deleteUsers` | `ids` (array) |

### Sessions

| Method | Parameters |
|---|---|
| `getUserSessions` | `userid` |
| `deleteUserSession` | `userid, sessionToken` |
| `deleteExpiredUserSessions` | `userid` |

### Groups

| Method | Parameters |
|---|---|
| `listGroups` | (none) |
| `getUserGroups` | `userid` |
| `addUserToGroup` | `userid, groupName` |
| `removeUserFromGroup` | `userid, groupName` |

## Frontend Components

Kempo provides web components you can use in your pages:

```html
<script type="module" src="/kempo/components/Permission.js"></script>
<kempo-permission has="system:admin:access">
  <a href="/admin">Admin Panel</a>
</kempo-permission>
```

| Component | Tag | Purpose |
|---|---|---|
| `Permission.js` | `<kempo-permission>` | Conditionally render content based on permissions |
| `LogoutBtn.js` | `<kempo-logout-btn>` | Logout button |
| `UserName.js` | `<kempo-user-name>` | Display current user's name |
| `UserEmail.js` | `<kempo-user-email>` | Display current user's email |
| `UserEmailVerified.js` | `<kempo-user-email-verified>` | Display email verification status |
| `UserCreatedAt.js` | `<kempo-user-created-at>` | Display account creation date |

## Adding Routes

Create files in `public/` following the kempo-server routing convention. File names map to HTTP methods:

```
public/
  api/
    posts/
      GET.js          → GET  /api/posts
      POST.js         → POST /api/posts
      [id]/
        GET.js        → GET  /api/posts/:id
        PATCH.js      → PATCH /api/posts/:id
        DELETE.js      → DELETE /api/posts/:id
```

Route handlers receive `(request, response)`:

```javascript
import db from 'kempo/server/db/index.js';
import { post } from '../../../server/db/schema.js';
import { eq } from 'drizzle-orm';

export default async (request, response) => {
  const posts = await db.select().from(post);
  response.json({ posts });
};
```

`request.body` is pre-parsed based on `Content-Type`. Query params are at `request.query`. Cookies are at `request.cookies`. Path params from `[param]` folders are at `request.params`.

## Auth Middleware

The auth middleware protects `/account` and `/admin` routes by default:

- `/account/*` — Requires a valid session. Redirects to `/login` if not authenticated.
- `/admin/*` — Requires the `system:admin:access` permission. Redirects to `/account` if unauthorized.

These are configured in `public/.config.json` and can be customized.

## Default Permissions

The `init-db.js` script seeds these permissions:

| Permission | Description |
|---|---|
| `system:admin:access` | Access admin panel |
| `system:content:create` | Create new content |
| `system:content:update` | Edit content |
| `system:content:delete` | Delete content |
| `system:user:create` | Create new users |
| `system:user:read` | View users |
| `system:user:update` | Edit users |
| `system:user:delete` | Delete users |
| `system:group:create` | Create new groups |
| `system:group:read` | View groups |
| `system:group:update` | Edit groups and manage membership |
| `system:group:delete` | Delete groups |
| `system:permissions:read` | View permissions for all users |
| `system:permissions:manage` | Add or remove permissions |
| `system:settings:read` | View private settings |
| `system:settings:update` | Update settings |
| `system:custom-settings:manage` | Create and delete custom settings |

Two default groups are created:

- **system:Users** — Assigned to all users, no permissions by default.
- **system:Administrators** — Full system access (all permissions above).

## Default Settings

| Setting | Default | Type | Public | Description |
|---|---|---|---|---|
| `site_name` | `Kempo Site` | string | yes | The name of the website |
| `session_duration_days` | `7` | number | no | Session duration in days |
| `allow_registration` | `true` | boolean | yes | Allow new users to register |
| `require_email_verification` | `false` | boolean | no | Require email verification before account access |
| `verification_url` | `http://localhost:3000/verify-email/{{token}}` | string | no | Email verification URL template |
| `password_reset_url` | `http://localhost:3000/reset-password/{{token}}` | string | no | Password reset URL template |

Settings can be managed through the admin panel at `/admin/settings` or the SDK.

## Email

Kempo uses [Resend](https://resend.com/) for sending emails. Set `RESEND_API_KEY` and `EMAIL_FROM` in your `.env` file.

Built-in email templates (in `templates/emails/`):
- `verify-email.html` — Email verification link
- `reset-password.html` — Password reset link

## Styling

Kempo uses [kempo-css](https://github.com/dustinpoissant/kempo-css) for styling and [kempo-ui](https://github.com/dustinpoissant/kempo-ui) for UI components. Both are served automatically via custom routes configured in `public/.config.json`.

```html
<link rel="stylesheet" href="/kempo-css/kempo.min.css">
<script type="module" src="/kempo-ui/components/Import.js"></script>
```

Refer to the [kempo-css docs](https://github.com/dustinpoissant/kempo-css) and [kempo-ui docs](https://github.com/dustinpoissant/kempo-ui) for available utility classes and components.

## License

MIT
