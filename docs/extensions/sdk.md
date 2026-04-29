# Kempo Server SDK

The Kempo Server SDK provides a comprehensive set of utilities for building extensions and backend logic. All utilities follow a consistent pattern: they accept pure data parameters and return a tuple of `[error, result]`.

## Error Handling Pattern

All SDK functions use the structured error tuple pattern:

```javascript
const [error, result] = await functionName(params);

if(error){
  // Handle error: error has { code, msg }
  console.error(`Error (${error.code}): ${error.msg}`);
  return;
}

// Use result
```

**Pattern:**
- Success: `[null, data]`
- Failure: `[{ code: 400, msg: 'Error message' }, null]`

The error `code` is always an HTTP-compatible status code (400, 401, 403, 404, 409, 500).

## Database

Access the raw database connection and schema:

```javascript
import { db, schema } from 'kempo/server/sdk.js';
```

- **`db`** — Drizzle ORM database connection. Use for custom queries.
- **`schema`** — All exported tables from `server/db/schema.js`.

### Example

```javascript
import { db, schema } from 'kempo/server/sdk.js';
import { eq } from 'drizzle-orm';

const user = await db.select().from(schema.user).where(eq(schema.user.id, userId));
```

## Auth

User authentication and session management.

### `changePassword({ token, currentPassword, newPassword })`

Change the current user's password.

```javascript
import { changePassword } from 'kempo/server/sdk.js';

const [error, result] = await changePassword({
  token: 'session_token_here',
  currentPassword: 'old_pass',
  newPassword: 'new_pass'
});
```

### `getSession({ token })`

Retrieve session and user info from a session token.

```javascript
import { getSession } from 'kempo/server/sdk.js';

const [error, sessionData] = await getSession({ token });
if(!error) {
  console.log(sessionData.user); // { id, email, name, ... }
}
```

### `loginEmail({ email, password })`

Log in with email and password. Returns session token.

```javascript
import { loginEmail } from 'kempo/server/sdk.js';

const [error, session] = await loginEmail({
  email: 'user@example.com',
  password: 'password123'
});
// session has: { token, user: { id, email, name, ... } }
```

### `logout({ token })`

Log out and invalidate the session token.

```javascript
import { logout } from 'kempo/server/sdk.js';

const [error, result] = await logout({ token });
```

### `registerEmail({ email, password, name })`

Register a new user with email and password. Returns session token.

```javascript
import { registerEmail } from 'kempo/server/sdk.js';

const [error, session] = await registerEmail({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe'
});
```

### `requestPasswordReset({ email })`

Request a password reset link (sends email).

```javascript
import { requestPasswordReset } from 'kempo/server/sdk.js';

const [error] = await requestPasswordReset({
  email: 'user@example.com'
});
```

### `resetPassword({ token, newPassword })`

Complete a password reset with a reset token.

```javascript
import { resetPassword } from 'kempo/server/sdk.js';

const [error] = await resetPassword({
  token: 'reset_token_from_email',
  newPassword: 'new_password'
});
```

### `sendVerificationEmail({ token })`

Send a verification email to the current user.

```javascript
import { sendVerificationEmail } from 'kempo/server/sdk.js';

const [error] = await sendVerificationEmail({ token });
```

### `verifyEmail({ token })`

Verify an email with a verification token from email.

```javascript
import { verifyEmail } from 'kempo/server/sdk.js';

const [error] = await verifyEmail({
  token: 'verification_token_from_email'
});
```

## Users

User CRUD operations.

### `createUser({ email, password, name })`

Create a new user.

```javascript
import { createUser } from 'kempo/server/sdk.js';

const [error, user] = await createUser({
  email: 'user@example.com',
  password: 'password123',
  name: 'John Doe'
});
```

### `getUserById(id)`

Get a user by ID.

```javascript
import { getUserById } from 'kempo/server/sdk.js';

const [error, user] = await getUserById('user_id');
```

### `getUserByEmail(email)`

Get a user by email address.

```javascript
import { getUserByEmail } from 'kempo/server/sdk.js';

const [error, user] = await getUserByEmail('user@example.com');
```

### `getUsers()`

List all users.

```javascript
import { getUsers } from 'kempo/server/sdk.js';

const [error, users] = await getUsers();
```

### `findUsersByEmail(email)`

Find users matching an email pattern.

```javascript
import { findUsersByEmail } from 'kempo/server/sdk.js';

const [error, users] = await findUsersByEmail('example.com');
```

### `findUsersByName(name)`

Find users matching a name pattern.

```javascript
import { findUsersByName } from 'kempo/server/sdk.js';

const [error, users] = await findUsersByName('John');
```

### `searchUsers({ query, limit })`

Search users by email or name.

```javascript
import { searchUsers } from 'kempo/server/sdk.js';

const [error, users] = await searchUsers({
  query: 'john',
  limit: 10
});
```

### `updateUser(id, { email, password, name })`

Update a user's details.

```javascript
import { updateUser } from 'kempo/server/sdk.js';

const [error, user] = await updateUser('user_id', {
  name: 'New Name'
});
```

### `deleteUser(id)`

Delete a user.

```javascript
import { deleteUser } from 'kempo/server/sdk.js';

const [error] = await deleteUser('user_id');
```

## Sessions

Session management.

### `createSession({ userId, expiresAt })`

Create a new session for a user.

```javascript
import { createSession } from 'kempo/server/sdk.js';

const [error, session] = await createSession({
  userId: 'user_id',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
});
```

### `getSessionByToken(token)`

Get session data by token.

```javascript
import { getSessionByToken } from 'kempo/server/sdk.js';

const [error, session] = await getSessionByToken('token');
```

### `getSessionById(id)`

Get session by ID.

```javascript
import { getSessionById } from 'kempo/server/sdk.js';

const [error, session] = await getSessionById('session_id');
```

### `getSessions()`

List all active sessions.

```javascript
import { getSessions } from 'kempo/server/sdk.js';

const [error, sessions] = await getSessions();
```

### `getUserSessions(userId)`

List all sessions for a specific user.

```javascript
import { getUserSessions } from 'kempo/server/sdk.js';

const [error, sessions] = await getUserSessions('user_id');
```

### `deleteSession(token)`

Delete a session by token.

```javascript
import { deleteSession } from 'kempo/server/sdk.js';

const [error] = await deleteSession('token');
```

### `deleteUserSessions(userId)`

Delete all sessions for a user.

```javascript
import { deleteUserSessions } from 'kempo/server/sdk.js';

const [error] = await deleteUserSessions('user_id');
```

### `deleteExpiredUserSessions(userId)`

Delete expired sessions for a user.

```javascript
import { deleteExpiredUserSessions } from 'kempo/server/sdk.js';

const [error] = await deleteExpiredUserSessions('user_id');
```

## Permissions

User permission management.

### `getUserPermissions(userId)`

Get all permissions for a user.

```javascript
import { getUserPermissions } from 'kempo/server/sdk.js';

const [error, permissions] = await getUserPermissions('user_id');
```

### `userHasPermission(userId, permissionName)`

Check if a user has a specific permission.

```javascript
import { userHasPermission } from 'kempo/server/sdk.js';

const [error, hasPermission] = await userHasPermission('user_id', 'blog:posts:create');
if(!error && hasPermission){
  // User has permission
}
```

### `userHasAllPermissions(userId, permissionNames)`

Check if a user has all specified permissions.

```javascript
import { userHasAllPermissions } from 'kempo/server/sdk.js';

const [error, hasAll] = await userHasAllPermissions('user_id', [
  'blog:posts:create',
  'blog:posts:delete'
]);
```

### `userHasSomePermissions(userId, permissionNames)`

Check if a user has at least one of the specified permissions.

```javascript
import { userHasSomePermissions } from 'kempo/server/sdk.js';

const [error, hasSome] = await userHasSomePermissions('user_id', [
  'blog:posts:edit',
  'blog:posts:admin'
]);
```

### `currentUserHasPermission(token, permissionName)`

Check if the current user (by session token) has a permission.

```javascript
import { currentUserHasPermission } from 'kempo/server/sdk.js';

const [error, hasPermission] = await currentUserHasPermission(token, 'blog:posts:create');
```

### `currentUserHasAllPermissions(token, permissionNames)`

Check if current user has all specified permissions.

```javascript
import { currentUserHasAllPermissions } from 'kempo/server/sdk.js';

const [error, hasAll] = await currentUserHasAllPermissions(token, [
  'blog:posts:create',
  'blog:posts:delete'
]);
```

### `currentUserHasSomePermissions(token, permissionNames)`

Check if current user has at least one of the specified permissions.

```javascript
import { currentUserHasSomePermissions } from 'kempo/server/sdk.js';

const [error, hasSome] = await currentUserHasSomePermissions(token, [
  'blog:posts:edit',
  'blog:posts:admin'
]);
```

### `createPermission({ name, description })`

Create a new permission.

```javascript
import { createPermission } from 'kempo/server/sdk.js';

const [error, permission] = await createPermission({
  name: 'blog:posts:create',
  description: 'Create blog posts'
});
```

### `deletePermission(name)`

Delete a permission.

```javascript
import { deletePermission } from 'kempo/server/sdk.js';

const [error] = await deletePermission('blog:posts:create');
```

### `updatePermission(name, { description })`

Update a permission's metadata.

```javascript
import { updatePermission } from 'kempo/server/sdk.js';

const [error, permission] = await updatePermission('blog:posts:create', {
  description: 'Updated description'
});
```

### `getAllPermissions()`

List all permissions in the system.

```javascript
import { getAllPermissions } from 'kempo/server/sdk.js';

const [error, permissions] = await getAllPermissions();
```

### `getUserPermission(userId, permissionName)`

Get metadata for a specific user permission.

```javascript
import { getUserPermission } from 'kempo/server/sdk.js';

const [error, permission] = await getUserPermission('user_id', 'blog:posts:create');
```

### `getPermissionsForGroups(groupIds)`

Get permissions assigned to specific groups.

```javascript
import { getPermissionsForGroups } from 'kempo/server/sdk.js';

const [error, permissions] = await getPermissionsForGroups(['group1', 'group2']);
```

### `getUserGroups(userId)`

Get all groups a user belongs to.

```javascript
import { getUserGroups } from 'kempo/server/sdk.js';

const [error, groups] = await getUserGroups('user_id');
```

## Groups

User group management.

### `createGroup({ name, description })`

Create a new group.

```javascript
import { createGroup } from 'kempo/server/sdk.js';

const [error, group] = await createGroup({
  name: 'blog:Authors',
  description: 'Blog post authors'
});
```

### `getGroup(id)`

Get a group by ID.

```javascript
import { getGroup } from 'kempo/server/sdk.js';

const [error, group] = await getGroup('group_id');
```

### `listGroups()`

List all groups.

```javascript
import { listGroups } from 'kempo/server/sdk.js';

const [error, groups] = await listGroups();
```

### `updateGroup(id, { name, description })`

Update a group.

```javascript
import { updateGroup } from 'kempo/server/sdk.js';

const [error, group] = await updateGroup('group_id', {
  description: 'New description'
});
```

### `deleteGroup(id)`

Delete a group.

```javascript
import { deleteGroup } from 'kempo/server/sdk.js';

const [error] = await deleteGroup('group_id');
```

### `addUserToGroup(userId, groupId)`

Add a user to a group.

```javascript
import { addUserToGroup } from 'kempo/server/sdk.js';

const [error] = await addUserToGroup('user_id', 'group_id');
```

### `removeUserFromGroup(userId, groupId)`

Remove a user from a group.

```javascript
import { removeUserFromGroup } from 'kempo/server/sdk.js';

const [error] = await removeUserFromGroup('user_id', 'group_id');
```

### `getGroupMembers(groupId)`

Get all users in a group.

```javascript
import { getGroupMembers } from 'kempo/server/sdk.js';

const [error, members] = await getGroupMembers('group_id');
```

## Settings

System and extension settings.

### `getSetting(owner, name, defaultValue)`

Get a setting value by owner and name.

```javascript
import { getSetting } from 'kempo/server/sdk.js';

const postsPerPage = await getSetting('blog', 'posts_per_page', 10);
const commentsEnabled = await getSetting('blog', 'allow_comments', true);
```

Note: This function returns the value directly (not a tuple) for convenience.

### `setSetting({ owner, name, value, type, public })`

Set a setting value.

```javascript
import { setSetting } from 'kempo/server/sdk.js';

const [error, setting] = await setSetting({
  owner: 'blog',
  name: 'posts_per_page',
  value: '20',
  type: 'number',
  public: false
});
```

### `listSettings()`

List all settings.

```javascript
import { listSettings } from 'kempo/server/sdk.js';

const [error, settings] = await listSettings();
```

### `getSettingsByOwner(owner)`

Get all settings for a specific owner.

```javascript
import { getSettingsByOwner } from 'kempo/server/sdk.js';

const [error, settings] = await getSettingsByOwner('blog');
```

### `getPublicSettings()`

Get all public settings (for frontend use).

```javascript
import { getPublicSettings } from 'kempo/server/sdk.js';

const [error, publicSettings] = await getPublicSettings();
```

### `getSettingWithMetadata(owner, name, defaultValue)`

Get a setting with its type and metadata.

```javascript
import { getSettingWithMetadata } from 'kempo/server/sdk.js';

const [error, setting] = await getSettingWithMetadata('blog', 'posts_per_page');
// setting: { name, value, type, owner, public, createdAt, updatedAt }
```

### `deleteSetting(owner, name)`

Delete a setting.

```javascript
import { deleteSetting } from 'kempo/server/sdk.js';

const [error] = await deleteSetting('blog', 'posts_per_page');
```

## Pages

Page management. All page objects returned by these utilities include:

- **Default metadata**: `name`, `title`, `owner`, `author`, `description`, `locked`, `createdAt`, `updatedAt`
- **`extraMetadata`**: An object containing any additional metadata keys set by extensions. Always present (empty `{}` if none).

### Reserved Metadata Keys

The following keys are reserved and cannot be used as `extraMetadata` keys: `owner`, `name`, `author`, `created`, `updated`, `locked`, `title`, `description`. Attempting to use them will return a `400` error.

### Page Locking

A page can be marked as `locked: true` to prevent editing outside of extension admin interfaces. Locked pages cannot be updated, deleted, moved, or disabled through the standard utils. Extensions that own a locked page can still modify it using `force: true` in `updatePage`, or manage the lock state via `setPageLocked`.

### `listPages({ rootDir, owner })`

List all pages in a directory, optionally filtered by owner.

```javascript
import { listPages } from 'kempo/server/sdk.js';

const [error, { pages, total }] = await listPages({
  rootDir: './pages',
  owner: 'custom' // optional
});
// Each page includes: { file, url, name, title, owner, locked, author, description, createdAt, updatedAt, extraMetadata }
```

### `getPage({ rootDir, file })`

Get a specific page by file path.

```javascript
import { getPage } from 'kempo/server/sdk.js';

const [error, page] = await getPage({
  rootDir: './pages',
  file: 'posts/index.page.html'
});
// page includes: { file, name, title, owner, locked, author, description, createdAt, updatedAt, extraMetadata, contents }
```

### `createPage({ rootDir, directory, name, template, author, locked, extraMetadata })`

Create a new page file.

```javascript
import { createPage } from 'kempo/server/sdk.js';

const [error, page] = await createPage({
  rootDir: './pages',
  name: 'New Post',
  directory: 'blog',
  template: 'post',
  author: 'Jane',
  locked: true, // optional, default false
  extraMetadata: { category: 'news', status: 'draft' } // optional
});
```

### `updatePage({ rootDir, file, name, title, description, author, template, contents, extraMetadata, force })`

Update a page. Pass `extraMetadata` to merge new keys into existing extra metadata without overwriting fields set by other extensions. Pass `force: true` to update a locked page (for extensions that own the page).

```javascript
import { updatePage } from 'kempo/server/sdk.js';

const [error, result] = await updatePage({
  rootDir: './pages',
  file: 'blog/my-post.page.html',
  extraMetadata: { category: 'tutorials', status: 'published' }
});

// Force-update a locked page (extension use only):
const [error, result] = await updatePage({
  rootDir: './pages',
  file: 'blog/my-post.page.html',
  extraMetadata: { status: 'archived' },
  force: true
});
```

### `setPageLocked({ rootDir, file, locked })`

Set or clear the locked status of a page. Extensions use this to take ownership of pages and prevent editing through the standard admin interface.

```javascript
import { setPageLocked } from 'kempo/server/sdk.js';

// Lock a page
const [error] = await setPageLocked({ rootDir: './pages', file: 'blog/post.page.html', locked: true });

// Unlock a page
const [error] = await setPageLocked({ rootDir: './pages', file: 'blog/post.page.html', locked: false });
```

### `searchByMetadata({ rootDir, query })`

Search pages by `extraMetadata` key/value pairs. All keys in `query` must match exactly. Note that this scans all page files — for extensions with large datasets (thousands of pages), consider maintaining a database table instead.

```javascript
import { searchByMetadata } from 'kempo/server/sdk.js';

const [error, { pages, total }] = await searchByMetadata({
  rootDir: './pages',
  query: { category: 'tutorials', status: 'published' }
});
```

### `deletePage({ rootDir, files })`

Delete one or more pages. Locked pages cannot be deleted.

```javascript
import { deletePage } from 'kempo/server/sdk.js';

const [error] = await deletePage({
  rootDir: './pages',
  files: ['posts/old.page.html']
});
```

### `disablePage({ rootDir, file })`

Disable a page (rename to `.page-disabled.html`).

```javascript
import { disablePage } from 'kempo/server/sdk.js';

const [error, page] = await disablePage({
  rootDir: './pages',
  file: 'posts/draft.page.html'
});
```

### `enablePage({ rootDir, file })`

Enable a disabled page (rename from `.page-disabled.html`).

```javascript
import { enablePage } from 'kempo/server/sdk.js';

const [error, page] = await enablePage({
  rootDir: './pages',
  file: 'posts/draft.page-disabled.html'
});
```

### `movePage({ rootDir, from, to })`

Move or rename a page. Locked pages cannot be moved.

```javascript
import { movePage } from 'kempo/server/sdk.js';

const [error, page] = await movePage({
  rootDir: './pages',
  from: 'old-path/page.page.html',
  to: 'new-path/page.page.html'
});
```

### `listDirectories(rootDir)`

List all directories in a page root.

```javascript
import { listDirectories } from 'kempo/server/sdk.js';

const [error, dirs] = await listDirectories('./pages');
```

### `listTemplates(rootDir)`

List all template files in a directory.

```javascript
import { listTemplates } from 'kempo/server/sdk.js';

const [error, templates] = await listTemplates('./pages');
```

## Templates

Template file management. All template objects include:

- **Default metadata**: `name`, `title`, `owner`, `author`, `locked`, `createdAt`, `updatedAt`

### Template Locking

A template can be marked as `locked: true` to prevent editing outside of extension admin interfaces. Locked templates cannot be updated, deleted, moved, or disabled through the standard utils. Extensions that own a locked template can still modify it using `force: true` in `updateTemplate`, or manage the lock state via `setTemplateLocked`.

### `createTemplate({ rootDir, relativePath, title, content, locked })`

Create a new template file.

```javascript
import { createTemplate } from 'kempo/server/sdk.js';

const [error, template] = await createTemplate({
  rootDir: './templates',
  relativePath: 'post-layout.template.html',
  title: 'Post Layout',
  content: '<template>...</template>',
  locked: true // optional, default false
});
```

### `getTemplate({ rootDir, file })`

Get a specific template.

```javascript
import { getTemplate } from 'kempo/server/sdk.js';

const [error, template] = await getTemplate({
  rootDir: './templates',
  file: 'post-layout.template.html'
});
```

### `updateTemplate({ rootDir, file, title, content, force })`

Update a template. Pass `force: true` to update a locked template (for extensions that own the template).

```javascript
import { updateTemplate } from 'kempo/server/sdk.js';

const [error, template] = await updateTemplate({
  rootDir: './templates',
  file: 'post-layout.template.html',
  title: 'Updated Layout',
  content: '<template>...</template>'
});

// Force-update a locked template (extension use only):
const [error, template] = await updateTemplate({
  rootDir: './templates',
  file: 'post-layout.template.html',
  content: '<template>Updated...</template>',
  force: true
});
```

### `setTemplateLocked({ rootDir, file, locked })`

Set or clear the locked status of a template. Extensions use this to take ownership of templates and prevent editing through the standard admin interface.

```javascript
import { setTemplateLocked } from 'kempo/server/sdk.js';

// Lock a template
const [error] = await setTemplateLocked({ rootDir: './templates', file: 'post-layout.template.html', locked: true });

// Unlock a template
const [error] = await setTemplateLocked({ rootDir: './templates', file: 'post-layout.template.html', locked: false });
```

### `deleteTemplate({ rootDir, file })`

Delete a template.

```javascript
import { deleteTemplate } from 'kempo/server/sdk.js';

const [error] = await deleteTemplate({
  rootDir: './templates',
  file: 'old-layout.template.html'
});
```

### `disableTemplate({ rootDir, file })`

Disable a template.

```javascript
import { disableTemplate } from 'kempo/server/sdk.js';

const [error, template] = await disableTemplate({
  rootDir: './templates',
  file: 'post-layout.template.html'
});
```

### `enableTemplate({ rootDir, file })`

Enable a disabled template.

```javascript
import { enableTemplate } from 'kempo/server/sdk.js';

const [error, template] = await enableTemplate({
  rootDir: './templates',
  file: 'post-layout.template-disabled.html'
});
```

## Fragments

Fragment file management. All fragment objects include:

- **Default metadata**: `name`, `owner`, `author`, `locked`, `createdAt`, `updatedAt`

### Fragment Locking

A fragment can be marked as `locked: true` to prevent editing outside of extension admin interfaces. Locked fragments cannot be updated, deleted, moved, or disabled through the standard utils. Extensions that own a locked fragment can still modify it using `force: true` in `updateFragment`, or manage the lock state via `setFragmentLocked`.

### `listFragments({ rootDir })`

List all fragments in a directory.

```javascript
import { listFragments } from 'kempo/server/sdk.js';

const [error, { fragments, total }] = await listFragments({
  rootDir: './fragments'
});
// Each fragment includes: { file, name, owner, locked, author, createdAt, updatedAt }
```

### `getFragment({ rootDir, file })`

Get a specific fragment by file path.

```javascript
import { getFragment } from 'kempo/server/sdk.js';

const [error, fragment] = await getFragment({
  rootDir: './fragments',
  file: 'sidebar.fragment.html'
});
// fragment includes: { file, name, owner, locked, author, createdAt, updatedAt, markup }
```

### `createFragment({ rootDir, directory, name, author, locked })`

Create a new fragment file.

```javascript
import { createFragment } from 'kempo/server/sdk.js';

const [error, fragment] = await createFragment({
  rootDir: './fragments',
  name: 'Navigation Menu',
  directory: 'components',
  author: 'Jane',
  locked: true // optional, default false
});
```

### `updateFragment({ rootDir, file, author, markup, force })`

Update a fragment. Pass `force: true` to update a locked fragment (for extensions that own the fragment).

```javascript
import { updateFragment } from 'kempo/server/sdk.js';

const [error, fragment] = await updateFragment({
  rootDir: './fragments',
  file: 'sidebar.fragment.html',
  markup: '<aside>Updated content</aside>'
});

// Force-update a locked fragment (extension use only):
const [error, fragment] = await updateFragment({
  rootDir: './fragments',
  file: 'sidebar.fragment.html',
  markup: '<aside>New content</aside>',
  force: true
});
```

### `setFragmentLocked({ rootDir, file, locked })`

Set or clear the locked status of a fragment. Extensions use this to take ownership of fragments and prevent editing through the standard admin interface.

```javascript
import { setFragmentLocked } from 'kempo/server/sdk.js';

// Lock a fragment
const [error] = await setFragmentLocked({ rootDir: './fragments', file: 'sidebar.fragment.html', locked: true });

// Unlock a fragment
const [error] = await setFragmentLocked({ rootDir: './fragments', file: 'sidebar.fragment.html', locked: false });
```

### `deleteFragment({ rootDir, files })`

Delete one or more fragments.

```javascript
import { deleteFragment } from 'kempo/server/sdk.js';

const [error] = await deleteFragment({
  rootDir: './fragments',
  files: ['old-sidebar.fragment.html', 'deprecated.fragment.html']
});
```

### `disableFragment({ rootDir, file })`

Disable a fragment.

```javascript
import { disableFragment } from 'kempo/server/sdk.js';

const [error, fragment] = await disableFragment({
  rootDir: './fragments',
  file: 'sidebar.fragment.html'
});
```

### `enableFragment({ rootDir, file })`

Enable a disabled fragment.

```javascript
import { enableFragment } from 'kempo/server/sdk.js';

const [error, fragment] = await enableFragment({
  rootDir: './fragments',
  file: 'sidebar.fragment-disabled.html'
});
```

## Global Content

Sitewide content blocks managed via ID. All global content objects include:

- **Default metadata**: `id`, `name`, `owner`, `author`, `locked`, `createdAt`, `updatedAt`, `location`, `priority`

### Global Content Locking

Global content can be marked as `locked: true` to prevent editing outside of extension admin interfaces. Locked entries cannot be updated or deleted through the standard utils. Extensions that own a locked entry can still modify it using `force: true` in `updateGlobalContent`, or manage the lock state via `setGlobalContentLocked`.

### `listGlobalContent({ rootDir })`

List all global content entries.

```javascript
import { listGlobalContent } from 'kempo/server/sdk.js';

const [error, { entries, total }] = await listGlobalContent({
  rootDir: './app-public'
});
// Each entry includes: { id, name, owner, locked, author, location, priority, createdAt, updatedAt }
```

### `getGlobalContent({ rootDir, id })`

Get a global content entry by ID.

```javascript
import { getGlobalContent } from 'kempo/server/sdk.js';

const [error, entry] = await getGlobalContent({
  rootDir: './app-public',
  id: 'content-id-123'
});
// entry includes: { id, name, owner, locked, author, location, priority, createdAt, updatedAt, markup }
```

### `createGlobalContent({ rootDir, name, author, markup, location, priority, locked })`

Create a new global content entry.

```javascript
import { createGlobalContent } from 'kempo/server/sdk.js';

const [error, entry] = await createGlobalContent({
  rootDir: './app-public',
  name: 'Site Header',
  author: 'Admin',
  markup: '<header>Welcome</header>',
  location: 'header',
  priority: 100,
  locked: true // optional, default false
});
```

### `updateGlobalContent({ rootDir, id, name, location, priority, markup, force })`

Update a global content entry. Pass `force: true` to update a locked entry (for extensions that own it).

```javascript
import { updateGlobalContent } from 'kempo/server/sdk.js';

const [error, entry] = await updateGlobalContent({
  rootDir: './app-public',
  id: 'content-id-123',
  markup: '<header>Updated</header>'
});

// Force-update a locked entry (extension use only):
const [error, entry] = await updateGlobalContent({
  rootDir: './app-public',
  id: 'content-id-123',
  markup: '<header>New</header>',
  force: true
});
```

### `setGlobalContentLocked({ rootDir, id, locked })`

Set or clear the locked status of a global content entry. Extensions use this to take ownership of entries and prevent editing through the standard admin interface.

```javascript
import { setGlobalContentLocked } from 'kempo/server/sdk.js';

// Lock a global content entry
const [error] = await setGlobalContentLocked({ rootDir: './app-public', id: 'content-id-123', locked: true });

// Unlock a global content entry
const [error] = await setGlobalContentLocked({ rootDir: './app-public', id: 'content-id-123', locked: false });
```

### `deleteGlobalContent({ rootDir, ids })`

Delete one or more global content entries.

```javascript
import { deleteGlobalContent } from 'kempo/server/sdk.js';

const [error] = await deleteGlobalContent({
  rootDir: './app-public',
  ids: ['content-id-123', 'content-id-456']
});
```

### `disableGlobalContent({ rootDir, id })`

Disable a global content entry.

```javascript
import { disableGlobalContent } from 'kempo/server/sdk.js';

const [error, entry] = await disableGlobalContent({
  rootDir: './app-public',
  id: 'content-id-123'
});
```

### `enableGlobalContent({ rootDir, id })`

Enable a disabled global content entry.

```javascript
import { enableGlobalContent } from 'kempo/server/sdk.js';

const [error, entry] = await enableGlobalContent({
  rootDir: './app-public',
  id: 'content-id-123'
});
```

## Admin Global Content

Admin-only content configuration.

### `listAdminGlobalContent()`

List all admin global content.

```javascript
import { listAdminGlobalContent } from 'kempo/server/sdk.js';

const [error, content] = await listAdminGlobalContent();
```

### `getAdminGlobalContent(id)`

Get admin global content by ID.

```javascript
import { getAdminGlobalContent } from 'kempo/server/sdk.js';

const [error, content] = await getAdminGlobalContent('content_id');
```

### `createAdminGlobalContent({ owner, key, value, description })`

Create admin global content.

```javascript
import { createAdminGlobalContent } from 'kempo/server/sdk.js';

const [error, content] = await createAdminGlobalContent({
  owner: 'blog',
  key: 'posts_per_page',
  value: '10',
  description: 'How many posts per page'
});
```

### `updateAdminGlobalContent(id, { value })`

Update admin global content.

```javascript
import { updateAdminGlobalContent } from 'kempo/server/sdk.js';

const [error, content] = await updateAdminGlobalContent('content_id', {
  value: '20'
});
```

### `deleteAdminGlobalContent(id)`

Delete admin global content.

```javascript
import { deleteAdminGlobalContent } from 'kempo/server/sdk.js';

const [error] = await deleteAdminGlobalContent('content_id');
```

### `deleteAdminGlobalContentByOwner(owner)`

Delete all admin global content for an owner.

```javascript
import { deleteAdminGlobalContentByOwner } from 'kempo/server/sdk.js';

const [error] = await deleteAdminGlobalContentByOwner('blog');
```

### `disableAdminGlobalContent(id)`

Disable admin global content.

```javascript
import { disableAdminGlobalContent } from 'kempo/server/sdk.js';

const [error, content] = await disableAdminGlobalContent('content_id');
```

### `enableAdminGlobalContent(id)`

Enable admin global content.

```javascript
import { enableAdminGlobalContent } from 'kempo/server/sdk.js';

const [error, content] = await enableAdminGlobalContent('content_id');
```

## Email

Email sending utilities.

### `sendEmail({ to, subject, html })`

Send a raw email.

```javascript
import { sendEmail } from 'kempo/server/sdk.js';

const [error] = await sendEmail({
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Email content</p>'
});
```

### `sendEmailFromTemplate({ to, subject, template, data })`

Send an email using a template with variable substitution.

```javascript
import { sendEmailFromTemplate } from 'kempo/server/sdk.js';

const [error] = await sendEmailFromTemplate({
  to: 'user@example.com',
  subject: 'Welcome',
  template: 'welcome', // looks for templates/welcome.html
  data: { name: 'John', email: 'john@example.com' }
});
```

## Filesystem Utilities

Utilities for scanning and parsing files.

### `scanDir(rootDir, currentDir, callback)`

Recursively scan a directory and call callback for each entry.

```javascript
import { scanDir } from 'kempo/server/sdk.js';
import { readFile } from 'fs/promises';

const results = await scanDir(rootDir, rootDir, async (fullPath, entry, root) => {
  if(entry.isDirectory()) return null;
  
  const content = await readFile(fullPath, 'utf-8');
  return { path: fullPath, size: content.length };
});
```

The callback receives:
- `fullPath` — absolute path to the entry
- `entry` — Dirent object with `name`, `isDirectory()`, `isFile()`
- `root` — the root directory path

Return `null` to skip or exclude, otherwise return data to include.

### `parseFrontmatter(content)`

Parse YAML frontmatter from the start of a file.

```javascript
import { parseFrontmatter } from 'kempo/server/sdk.js';

const meta = parseFrontmatter(`---
title: My Page
author: John Doe
---
<page>Content here</page>`);

console.log(meta); // { title: 'My Page', author: 'John Doe' }
```

Frontmatter must be at the very start of the content, delimited by `---`.

## Hooks

Event hook management.

### Available Page Events

The following events are fired automatically during page operations. Register hooks for them in your extension's install script using `createHook`.

| Event | Data | Fired when |
|---|---|---|
| `page:created` | `{ file, url, name, author, extraMetadata }` | A new page is created |
| `page:updated` | `{ file, updatedAt }` | A page's metadata or content is updated |
| `page:deleted` | `{ file }` | A page is deleted |

**Example — reacting to page creation:**

```javascript
// hooks/page-created.js
export default async ({ file, name, extraMetadata }) => {
  // e.g. index the new page in a database table
};
```

```javascript
// install.js
import { createHook } from 'kempo/server/sdk.js';

await createHook({ event: 'page:created', callback: './hooks/page-created.js', owner: 'my-extension' });
```

### `createHook({ event, handler, owner })`

Register a hook for an event.

```javascript
import { createHook } from 'kempo/server/sdk.js';

const [error, hook] = await createHook({
  event: 'page-created',
  handler: 'hooks/on-page-created.js',
  owner: 'blog'
});
```

### `getHook(id)`

Get a hook by ID.

```javascript
import { getHook } from 'kempo/server/sdk.js';

const [error, hook] = await getHook('hook_id');
```

### `listHooks({ event, owner })`

List hooks, optionally filtered by event or owner.

```javascript
import { listHooks } from 'kempo/server/sdk.js';

const [error, hooks] = await listHooks({ event: 'page-created' });
```

### `updateHook(id, { handler })`

Update a hook.

```javascript
import { updateHook } from 'kempo/server/sdk.js';

const [error, hook] = await updateHook('hook_id', {
  handler: 'hooks/new-handler.js'
});
```

### `deleteHook(id)`

Delete a hook.

```javascript
import { deleteHook } from 'kempo/server/sdk.js';

const [error] = await deleteHook('hook_id');
```

### `triggerHook(eventName, data)`

Trigger all hooks registered for an event.

```javascript
import { triggerHook } from 'kempo/server/sdk.js';

const [error] = await triggerHook('page-created', {
  page: { id: '123', title: 'New Page' }
});
```

### `clearHandlerCache()`

Clear the internal hook handler cache (used after updating handlers).

```javascript
import { triggerHook, clearHandlerCache } from 'kempo/server/sdk.js';

clearHandlerCache();
```

## Extensions

Extension lifecycle management.

### `listExtensions()`

List all installed extensions.

```javascript
import { listExtensions } from 'kempo/server/sdk.js';

const [error, extensions] = await listExtensions();
```

### `getExtension(name)`

Get details about a specific extension.

```javascript
import { getExtension } from 'kempo/server/sdk.js';

const [error, extension] = await getExtension('blog');
```

### `installExtension(name)`

Install an extension from npm.

```javascript
import { installExtension } from 'kempo/server/sdk.js';

const [error, extension] = await installExtension('blog');
```

### `updateExtension(name)`

Update an extension to the latest version.

```javascript
import { updateExtension } from 'kempo/server/sdk.js';

const [error, extension] = await updateExtension('blog');
```

### `uninstallExtension(name)`

Uninstall an extension.

```javascript
import { uninstallExtension } from 'kempo/server/sdk.js';

const [error] = await uninstallExtension('blog');
```

### `enableExtension(name)`

Enable a disabled extension.

```javascript
import { enableExtension } from 'kempo/server/sdk.js';

const [error, extension] = await enableExtension('blog');
```

### `disableExtension(name)`

Disable an extension without uninstalling.

```javascript
import { disableExtension } from 'kempo/server/sdk.js';

const [error, extension] = await disableExtension('blog');
```

## Usage in Extensions

In your extension's hook handlers, route handlers, or lifecycle scripts:

```javascript
// hooks/page-created.js
import { triggerHook } from 'kempo/server/sdk.js';

export default async (data) => {
  const { page } = data;
  
  // Trigger custom events or perform operations
  await triggerHook('my-ext:page-processed', { page });
};
```

```javascript
// public/api/posts/POST.js
import { currentUserHasPermission, createPage } from 'kempo/server/sdk.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [err, allowed] = await currentUserHasPermission(token, 'blog:posts:create');
  
  if(err || !allowed){
    return response.status(403).json({ error: 'Forbidden' });
  }
  
  const [pageErr, page] = await createPage({
    rootDir: './pages',
    relativePath: `posts/${request.body.slug}.page.html`,
    title: request.body.title,
    content: request.body.content
  });
  
  if(pageErr){
    return response.status(pageErr.code).json({ error: pageErr.msg });
  }
  
  response.json({ page });
};
```
