# Notifications

## Description
Per-user messages raised by core or an extension, with independent read, handled and dismissed state, an optional action button (a same-site link or a same-site API call made by the browser), dedupe, retention, and a hook for other extensions to react.

## Dependencies
- [Database](../concepts/db.md) — `notification` and `notificationRecipient` tables
- [Users](users.md), [Groups](groups.md), [Permissions](permissions.md) — recipients are resolved from them
- [Hooks](hooks.md) — fires `notification:created`
- [Settings](settings.md) — `system:notification_retention_days`

## Context
Extensions need to tell people about things that happened out of band (a failed background job) so they can act. Every person must have their own state, and the history must not rewrite itself when permissions change.

### Decisions
- **Recipients fan out at creation**: a row per recipient rather than resolving "everyone with permission X" at read time. Read state is naturally per user and losing or gaining a permission cannot change history. Cost: a row per recipient.
- **Dedupe re-opens**: a repeat of `(owner, dedupeKey)` updates one row in place and resets read, handled and dismissed for the new recipients, so a repeating failure is one notification at the top of the list, not a flood. Earlier recipients not in the new call are untouched.
- **Actions are data, not code**: a link or an API call to a same-site path. Core never executes an action; the browser calls it as the signed-in user and the extension's route does its own permission checks. Paths are validated at creation (single leading `/`, no whitespace, backslashes or control characters) and again in the browser.
- **Title and message are plain text** and rendered as text.
- **Dismiss is per user**; delete for everyone is SDK-only. History is kept until the retention (`system:notification_retention_days`, default 90, 0 = forever) or `expiresAt`, pruned lazily at most hourly on creation.
- **Hook name** follows the `area:event` convention: `notification:created`.
- **No websocket**: the bell polls the count on load, focus, visibility and a 60 second interval.

## Implementation

### Location
`server/utils/notifications/*`, `server/db/schema.js`, `src/kempo/api/notifications/**`, `src/kempo/components/NotificationBell.js`, `src/kempo/components/NotificationList.js`, `src/admin/notifications/index.page.html`.

### Tables
`notification(id, owner, title, message, level, actions jsonb, dedupeKey, createdAt, updatedAt, expiresAt)` with a partial unique index on `(owner, dedupeKey)` where `dedupeKey` is not null; `notificationRecipient(notificationId, userId, readAt, handledAt, dismissedAt)` with a composite primary key and cascading deletes from both parents.

### Server SDK
`createNotification`, `getNotifications`, `getUnreadCount`, `markRead`, `markAllRead`, `markHandled`, `deleteNotification`, `pruneNotifications`. See [docs/notifications.md](../../docs/notifications.md).

### HTTP
`GET /kempo/api/notifications`, `GET .../count`, `POST .../read-all`, `POST .../:id/read`, `POST .../:id/handled`, `DELETE .../:id`. Session required; only the caller's own rows are reachable.

### Tests
`tests/notifications.node-test.js` (SDK), `tests/notifications-http.node-test.js` (HTTP contract and permissions), `tests/notifications.browser-test.js` (components, XSS, action safety).
