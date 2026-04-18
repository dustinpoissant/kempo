# Server Utils

## Description
Backend business logic functions that are completely HTTP-agnostic. Each util accepts pure JavaScript data (strings, numbers, objects) and returns an error tuple. They never access request/response objects.

## Dependencies
- [Database](db.md) — all utils that persist data use the `db` instance and schema

## Context
Server utils exist to decouple business logic from the HTTP transport layer. This means the same logic can be called from API route handlers, middleware, CLI scripts, extension hooks, or tests — without mocking HTTP objects.

### Decisions
- **Error tuple pattern**: Every util returns `[error, data]` where error is `null` on success or `{ code, msg }` on failure. Never throw exceptions.
- **HTTP-agnostic**: Utils must never import from `dist/` (API routes) or `middleware/`. They accept pure data and return pure data.
- **No request/response access**: Parameters like `token`, `userId`, `email` are passed as plain values extracted by the HTTP layer.
- **One function per file**: Each util is a single default export in its own file. The function name matches the filename.

## Implementation

### Directory Structure
```
server/utils/
├── auth/           # Authentication flows (login, register, verify, reset)
├── users/          # User CRUD and search
├── groups/         # Group CRUD and membership
├── permissions/    # Permission CRUD and checking
├── sessions/       # Session CRUD and cleanup
├── settings/       # Key-value settings CRUD
├── pages/          # Page file management
├── templates/      # Template file management
├── fragments/      # Fragment file management
├── global-content/ # Global content file management
├── admin-global-content/ # Admin-scoped global content
├── hooks/          # Hook CRUD and triggering
├── extensions/     # Extension install/uninstall/update/enable/disable/check
├── email/          # Email sending
└── fs/             # File system helpers (parseFrontmatter, scanDir)
```

### Error Tuple Pattern
```javascript
// Success
return [null, { id, name, email }];

// Failure
return [{ code: 404, msg: 'User not found' }, null];
```

HTTP-compatible codes: 400 (bad input), 401 (unauthenticated), 403 (forbidden), 404 (not found), 409 (conflict), 500 (internal).

### File-Based Resources
Pages, templates, fragments, and global content are stored as files on disk, not in the database. Their utils accept a `rootDir` parameter pointing to the public directory and manipulate `.page.html`, `.template.html`, `.fragment.html`, and `.global.html` files using frontmatter metadata.

## Notes
- `menus/fns/` utils are referenced by API routes but not yet implemented.
- The `fs/` utils (`parseFrontmatter`, `scanDir`) are general-purpose helpers shared across file-based resource utils.
