# Frontend SDK

## Description
A browser-side JavaScript module (`dist/kempo/sdk.js`) that provides functions for every API endpoint. Uses a deduplicating fetch wrapper and returns error tuples matching the server-side pattern.

## Dependencies
- [API](api.md) — every SDK function maps to an API endpoint
- `dist/kempo/fetch.js` — deduplicating fetch wrapper

## Context
The frontend SDK mirrors the server SDK in purpose: it gives frontend code a single import point for all CMS operations. It is used by admin pages, consumer-facing components, and any custom frontend code.

### Decisions
- **Deduplicating fetch**: Concurrent identical requests (same method, URL, body) are coalesced into a single network request. This prevents double-fetches from component renders.
- **Error tuple returns**: All functions return `[error, data]` matching the server pattern. Errors include `{ code, msg }` parsed from the response.
- **Named exports**: Each function is a named export. The module has no default export.
- **No auth token management**: The SDK relies on HTTP-only cookies set by the server. No token storage or header injection needed.

## Implementation

### Location
`dist/kempo/sdk.js` — available at `/kempo/sdk.js` in the browser.

### Fetch Module
`dist/kempo/fetch.js` exports: `get`, `post`, `put`, `patch`, `del`
- `get(url, params)` — auto-serializes params object to query string
- `post/put/patch(url, data)` — sends JSON body
- `del(url, data)` — sends JSON body with DELETE method
- All return `[error, data]` tuples
- All deduplicate in-flight requests by `method:url:body` key

### Function Categories
| Category | Functions |
|---|---|
| Auth | `register`, `login`, `logout`, `getSession`, `forgotPassword`, `resetPassword`, `changePassword`, `verifyEmail` |
| Permissions | `currentUserHasPermission`, `currentUserHasAllPermissions`, `currentUserHasSomePermissions`, `getAllCurrentUserPermissions`, `userHasPermission`, `userHasAllPermissions`, `userHasSomePermissions`, `getAllUserPermissions` |
| Users | `getUsers`, `createUser`, `deleteUsers`, `updateUser`, `getUser`, `getUserSessions`, `deleteUserSession`, `deleteExpiredUserSessions`, `getUserGroups`, `addUserToGroup`, `removeUserFromGroup` |
| Groups | `listGroups`, `createGroup`, `updateGroup`, `deleteGroups`, `getGroup`, `getGroupMembers`, `addMemberToGroup`, `removeMemberFromGroup`, `getGroupPermissions` |
| Permissions | `listPermissions`, `createPermissions`, `updatePermission`, `deletePermissions` |
| Settings | `getSetting`, `listSettings`, `setSetting`, `deleteSetting` |
| Pages | `listPages`, `listTemplates`, `listDirectories`, `getPage`, `createPage`, `updatePage`, `deletePages`, `movePage` |
| Templates | `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplates` |
| Menus | `listMenus`, `getMenu`, `getMenuBySlug`, `createMenu`, `updateMenu`, `deleteMenus`, `addMenuItem`, `updateMenuItem`, `deleteMenuItems` |
| Fragments | `listFragments`, `getFragment`, `createFragment`, `updateFragment`, `deleteFragments` |
| Global Content | `listGlobalContent`, `getGlobalContent`, `createGlobalContent`, `updateGlobalContent`, `deleteGlobalContent` |
| Extensions | `listExtensions`, `listAvailableExtensions`, `listKnownExtensions`, `installExtension`, `uninstallExtension`, `enableExtension`, `disableExtension` |
| Admin Globals | `listAdminGlobalContent`, `getAdminGlobalContent`, `createAdminGlobalContent`, `updateAdminGlobalContent`, `deleteAdminGlobalContent`, `enableAdminGlobalContent`, `disableAdminGlobalContent` |

## Notes
- Public settings can be fetched without authentication.
- Auth endpoints (login, register, forgot-password) do not require a session.
