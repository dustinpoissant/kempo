# Server SDK

## Description
A single module (`server/sdk.js`) that re-exports every server util as named exports. This provides extensions and internal code with a single import point for all backend functionality.

## Dependencies
- [Server Utils](server-utils.md) — every export originates from `server/utils/`
- [Database](db.md) — also re-exports `db` and `schema`

## Context
Without the SDK, extensions and API routes would need to know the exact file path of each util (e.g., `../../server/utils/users/getUserById.js`). The SDK provides a stable public API that decouples consumers from the internal file structure.

### Decisions
- **Named exports only, no default export**: The module has many exports, so named exports are used per the project's coding guidelines.
- **Re-exports everything**: Every server util is re-exported. If a util exists, it should be in the SDK.
- **Also exports `db` and `schema`**: Extensions may need direct database access for their own tables.

## Implementation

### Location
`server/sdk.js`

### Usage by Extensions
```javascript
import { db, schema, getUserById, createHook } from 'kempo/server/sdk.js';
```

### Export Categories
- **Database**: `db`, `schema`
- **Auth**: `changePassword`, `getSession`, `loginEmail`, `logout`, `registerEmail`, `requestPasswordReset`, `resetPassword`, `sendVerificationEmail`, `verifyEmail`
- **Users**: `createUser`, `deleteUser`, `findUsersByEmail`, `findUsersByName`, `getUserByEmail`, `getUserById`, `getUsers`, `updateUser`
- **Sessions**: `createSession`, `deleteExpiredUserSessions`, `deleteSession`, `deleteUserSessions`, `getSessionById`, `getSessionByToken`, `getSessions`, `getUserSessions`
- **Groups**: `addUserToGroup`, `createGroup`, `deleteGroup`, `getGroup`, `getGroupMembers`, `listGroups`, `removeUserFromGroup`, `updateGroup`
- **Permissions**: `createPermission`, `currentUserHasAllPermissions`, `currentUserHasPermission`, `currentUserHasSomePermissions`, `deletePermission`, `getAllPermissions`, `getPermissionsForGroups`, `getUserGroups`, `getUserPermission`, `getUserPermissions`, `updatePermission`, `userHasAllPermissions`, `userHasPermission`, `userHasSomePermissions`
- **Settings**: `deleteSetting`, `getPublicSettings`, `getSetting`, `getSettingsByOwner`, `getSettingWithMetadata`, `listSettings`, `setSetting`
- **Pages**: `createPage`, `deletePage`, `getPage`, `listDirectories`, `listPages`, `listTemplates`, `movePage`, `updatePage`
- **Templates**: `createTemplate`, `deleteTemplate`, `getTemplate`, `updateTemplate`
- **Fragments**: `createFragment`, `deleteFragment`, `getFragment`, `listFragments`, `updateFragment`
- **Global Content**: `createGlobalContent`, `deleteGlobalContent`, `getGlobalContent`, `listGlobalContent`, `updateGlobalContent`
- **Admin Global Content**: `createAdminGlobalContent`, `deleteAdminGlobalContent`, `deleteAdminGlobalContentByOwner`, `disableAdminGlobalContent`, `enableAdminGlobalContent`, `getAdminGlobalContent`, `listAdminGlobalContent`, `updateAdminGlobalContent`
- **Email**: `sendEmail`, `sendEmailFromTemplate`
- **FS**: `parseFrontmatter`, `scanDir`
- **Hooks**: `createHook`, `deleteHook`, `getHook`, `listHooks`, `triggerHook`, `clearHandlerCache`, `updateHook`
- **Extensions**: `disableExtension`, `enableExtension`, `getExtension`, `installExtension`, `listExtensions`, `uninstallExtension`, `updateExtension`

## Notes
- Menu utils are not yet re-exported because `server/utils/menus/` is not implemented yet.
