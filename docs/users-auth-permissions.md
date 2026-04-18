# Users, Auth & Permissions

## Users

Users have an email address, password (hashed), and an email verification status. They are created through registration (`/register`) or via the admin panel at `/admin/accounts/users`.

## Authentication

Kempo uses cookie-based session authentication. On login, a `session_token` cookie is set. The auth middleware validates this cookie on every request and makes the session available to route handlers.

### Auth Routes

| Route | Purpose |
|---|---|
| `POST /kempo/api/auth/login/email` | Log in with email + password |
| `POST /kempo/api/auth/logout` | Log out (deletes session) |
| `POST /kempo/api/auth/register` | Register a new account |
| `GET /kempo/api/auth/session` | Get the current session |
| `POST /kempo/api/auth/change-password` | Change password (requires current password) |
| `POST /kempo/api/forgot-password` | Send a password reset email |
| `POST /kempo/api/auth/reset-password` | Reset password from email token |
| `POST /kempo/api/auth/verify-email` | Verify email from token |

### Checking Authentication in Route Handlers

```javascript
import getCurrentUser from 'kempo/server/utils/users/getCurrentUser.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [error, user] = await getCurrentUser({ token });
  if(error) return response.status(401).json({ error: 'Not authenticated' });

  response.json({ user });
};
```

## Groups

Groups are named roles (e.g. `system:Administrators`, `blog:Bloggers`). Users can belong to multiple groups. Groups are managed in the Admin under **Accounts > Groups**.

### Group Name Convention

Group names use a colon-separated prefix to indicate ownership: `owner:GroupName`. System groups use `system:`, extensions use their package name.

### Adding Users to Groups

Via the admin panel or programmatically:

```javascript
import addUserToGroup from 'kempo/server/utils/groups/addUserToGroup.js';

const [error] = await addUserToGroup({ userId, groupName: 'blog:Bloggers' });
```

## Permissions

Permissions are named access rights (e.g. `system:pages:update`). They are assigned to groups, not directly to users. A user has a permission if they belong to at least one group that has that permission.

### Permission Name Convention

`owner:resource:action` — for example:
- `system:users:read` — can read user list
- `system:pages:update` — can edit pages
- `blog:posts:create` — can create blog posts

### Checking Permissions in Route Handlers

```javascript
import currentUserHasPermission from 'kempo/server/utils/permissions/currentUserHasPermission.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [err, allowed] = await currentUserHasPermission(token, 'system:pages:update');
  if(err) return response.status(err.code).json({ error: err.msg });
  if(!allowed) return response.status(403).json({ error: 'Forbidden' });

  // proceed...
};
```

### Checking Multiple Permissions

```javascript
import currentUserHasAllPermissions from 'kempo/server/utils/permissions/currentUserHasAllPermissions.js';
import currentUserHasSomePermissions from 'kempo/server/utils/permissions/currentUserHasSomePermissions.js';

// Requires ALL permissions
const [err, allowed] = await currentUserHasAllPermissions(token, [
  'system:users:read',
  'system:users:update',
]);

// Requires at least ONE permission
const [err, allowed] = await currentUserHasSomePermissions(token, [
  'system:admin:access',
  'blog:posts:create',
]);
```

## Default Permissions

Kempo seeds these permissions on first run:

| Permission | Purpose |
|---|---|
| `system:admin:access` | Access the admin panel |
| `system:users:read` | View the user list |
| `system:users:create` | Create users |
| `system:users:update` | Edit users |
| `system:users:delete` | Delete users |
| `system:groups:read` | View groups |
| `system:groups:manage` | Create/edit/delete groups |
| `system:permissions:read` | View permissions |
| `system:permissions:manage` | Create/edit/delete permissions |
| `system:pages:read` | View pages |
| `system:pages:update` | Edit pages |
| `system:pages:create` | Create pages |
| `system:pages:delete` | Delete pages |
| `system:settings:read` | View settings |
| `system:settings:update` | Edit settings |
| `system:custom-settings:manage` | Create/delete non-system settings |
| `system:extensions:read` | View extensions |
| `system:extensions:install` | Install extensions |
| `system:extensions:uninstall` | Uninstall extensions |
| `system:extensions:manage` | Enable/disable/update extensions |

## Default Groups

| Group | Permissions |
|---|---|
| `system:Administrators` | All system permissions |
| `system:Editors` | Pages, templates, fragments, global content |
| `system:Members` | Authenticated users with no special access |
