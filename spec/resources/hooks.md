# Hooks

## Description
Event callback registrations that allow extensions to respond to system events. When an event is triggered, all registered hook handlers for that event are executed with the event data.

## Dependencies
- [Database](../concepts/db.md) — `hook` table
- [Extensions](extensions.md) — hooks are registered during extension installation

## Context
Hooks are the mechanism by which extensions react to things happening in the CMS. For example, the `kempo-blog` extension registers a `page-created` hook to run custom logic when a new page is created.

### Decisions
- **Database-stored**: Hook registrations are rows in the `hook` table, not in-memory listeners. This makes them persistent across server restarts.
- **Owner-scoped**: Each hook has an `owner` field (the extension name). On extension uninstall, all hooks for that owner are deleted.
- **Callback paths**: The `callback` field is a relative file path within the extension package (e.g., `hooks/page-created.js`). The trigger system resolves this to an absolute path and dynamically imports it.
- **Handler caching**: Resolved handler modules are cached in memory for performance. The cache can be cleared with `clearHandlerCache()`.
- **Event naming convention**: Events use colon-separated names (e.g., `extension:installed`, `extension:uninstalled`, `page-created`).
- **Fire-and-forget**: Hook handlers are called but their return values are not used by the trigger system. Errors in handlers are caught and logged, not propagated.

## Implementation

### Schema
```
hook:
  id          text  PK (UUID)
  owner       text
  event       text
  callback    text
  createdAt   timestamp

Indexes: event, owner
```

### Server Utils (`server/utils/hooks/`)
| Util | Signature | Purpose |
|---|---|---|
| `createHook` | `({ owner, event, callback })` | Register a hook |
| `deleteHook` | `({ id })` | Delete a hook |
| `getHook` | `({ id })` | Get hook by ID |
| `listHooks` | `({ event, owner, limit, offset })` | List hooks with filters |
| `updateHook` | `({ id, callback })` | Update hook callback |
| `triggerHook` | `(event, data)` | Execute all handlers for an event |
| `clearHandlerCache` | exported | Clear cached handler modules |

### Hook Registration
Hooks are registered automatically during extension installation based on the `kempo.hooks` config in the extension's `package.json`:
```json
{
  "kempo": {
    "hooks": {
      "page-created": "hooks/page-created.js"
    }
  }
}
```

### Hook Handler Format
```javascript
// hooks/page-created.js
export default async (data) => {
  // data contains event-specific information
  console.log('Page created:', data);
};
```

### Trigger Flow
1. `triggerHook('page-created', { page })` is called
2. Query all hooks where `event = 'page-created'`
3. For each hook, resolve the callback path to the extension's package directory
4. Dynamically import the handler module (cached after first import)
5. Call the handler's default export with the event data
6. Catch and log any errors — do not propagate

## Notes
- There are no API routes for hooks — they are managed entirely through the server utils and extension install/uninstall flows.
- The built-in events are `extension:installed` and `extension:uninstalled`. Additional events can be triggered by calling `triggerHook` from server utils or extension code.
- Hooks are only for server-side events. There is no client-side hook system.
