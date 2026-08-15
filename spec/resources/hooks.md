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
- **Two contracts, one implementation**: by default a handler that throws is recorded and the rest still run (a *notification*). With `{ bail: true }` the error propagates and aborts the chain, which is what lets a handler veto the thing that triggered it — `middleware:before_page` uses this to block a page render by throwing `{ code }` or `{ redirect }`.
- **Awaited in order, not fire-and-forget**: handlers are awaited one at a time, so a slow handler delays whatever triggered the event. "Notification" describes error handling, not timing. A handler with slow work should start it and return rather than awaiting it inline.
- **Deterministic ordering**: handlers run in registration order (`createdAt`, then `id`), rather than whatever order the database returns rows in. Anything where handlers can observe each other's work depends on this being stable.
- **Shared, mutable payload**: `data` is passed to every handler by reference, so an event can carry state that handlers collaborate on. See the draft-response pattern below.

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

### The `route:unmatched` draft response

Fired by the site's `public/CATCH.js` for every URL nothing else on the site claimed — at any depth, with no prefix involved, because kempo-server walks upward looking for a CATCH file and the one at the site root is the final fallback. This is how an extension answers a request for something with no file behind it: a download served from a directory the static scanner deliberately cannot see, a short link, a generated feed.

Handlers never touch the response. `data.draft` is a plain object they fill in, and `server/utils/routing/serveUnmatched.js` performs the single real write once every handler has run:

```javascript
export default async ({ url, method, request, draft }) => {
  if(url !== '/my-thing') return;          // not mine — leave the draft alone
  draft.status = 200;
  draft.headers['Content-Type'] = 'text/plain';
  draft.body = 'hello';                     // or draft.filePath for something on disk
  draft.handled = true;
};
```

| Field | Effect |
|---|---|
| `filePath` | Streamed via kempo-server's own helper, so `Range`/`206` works (a gated video still seeks). Wins over `body`. |
| `body` | Written as-is with `status` (default `200`). |
| `status` | Response status. Defaults to `200` with a body, `204` when only `handled` is set. |
| `headers` | Merged into the response — including onto the default 404, so a handler can annotate a response it did not claim. |
| `handled` | Whether an earlier handler already answered. Set it when claiming. |

Because nothing is sent mid-chain, no handler can end the request early and silence the ones after it — an extension logging every 404 still sees requests another extension answered, and a later handler can add to a response already in progress. Handlers run in registration order and see earlier decisions through `draft.handled`.

This chain is on the critical path of every unmatched request, so a handler doing slow work should start it and return rather than awaiting it here.

## Notes
- There are no API routes for hooks — they are managed entirely through the server utils and extension install/uninstall flows.
- The built-in events are `extension:installed` and `extension:uninstalled`. Additional events can be triggered by calling `triggerHook` from server utils or extension code.
- `public/CATCH.js` degrades to rendering `CATCH.page.html` directly if the dispatcher cannot be loaded, so a half-finished install cannot turn every 404 on the site into a 500.
- Hooks are only for server-side events. There is no client-side hook system.
