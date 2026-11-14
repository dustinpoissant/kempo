# Notifications

## Description
Messages raised by core or an extension for a person (a signed-in user or a guest), shown by the browser on whatever page they land on next. Each has a type that decides how it is shown, a subtype, a priority, an optional expiry and an optional must-acknowledge, and each person has their own state as timestamps, an optional action button (a same-site link or a same-site API call made by the browser), dedupe, a history, retention, and a hook for other extensions to react.

## Dependencies
- [Database](../concepts/db.md) — `notification`, `notificationRecipient` and `notificationGuestRecipient` tables
- [Users](users.md), [Groups](groups.md), [Permissions](permissions.md) — recipients are resolved from them
- [Guests](guests.md) — a guest can be a recipient, and its notifications move to the account at login
- [Hooks](hooks.md) — fires `notification:created`
- [Settings](settings.md) — `system:notification_poll_seconds`, `_cooldown_seconds`, `_toast_seconds`, `_banner_seconds`, `_retention_days`

## Context
Something that happens out of band (a failed background job, a password change before a redirect, a new terms of use, a chat message while away) must reach a person even if they have left the page that caused it or use another device. Every person must have their own state, and the history must not rewrite itself when permissions change.

### Decisions
- **Recipients fan out at creation**: a row per recipient rather than resolving "everyone with permission X" at read time. State is naturally per person and losing or gaining a permission cannot change history. Cost: a row per recipient.
- **Types are free text; core draws five**: `toast`, `banner`, `notice`, `modal`, `inline`. Any other word is an extension's own type, which core's components ignore and the extension handles by subscribing to the client. There is no registry, because nothing on the server needs to know what a type looks like. A `subtype` is any word; the four levels (`success`, `error`, `warning`, `info`) only colour kempo's own types.
- **State is timestamps and status is derived**: `deliveredAt`, `viewedAt`, `acknowledgedAt`, `dismissedAt`, `lastShownAt`. `pending`, `delivered`, `viewed`, `acknowledged` and `dismissed` are worked out in that precedence, and `expired` is by the clock, so nothing can disagree with the timestamps. Each keeps the first time, except `lastShownAt`; viewing, showing and acknowledging also deliver, and acknowledging also views.
- **Viewed means seen long enough, not fetched**: a toast is viewed when it times out, so a person who navigates away early sees it again for its full time on the next page. A banner or inline message is viewed after the banner time on screen. A notice is viewed one second after the bell opens with it on screen.
- **mustAcknowledge repeats after a cooldown**: shown until acknowledged or expired, no sooner than the cooldown after it was last shown (`cooldownSeconds`, else the system setting). A modal always must, and has no way out but its buttons. Viewing does not stop it.
- **Pending is a read**: `GET .../pending` changes nothing; the browser reports `delivered`, `shown`, `viewed`, `acknowledge` and dismissals as they happen. It returns the settings and the count of unviewed notices so one request serves the page and the bell.
- **Priority orders the queue**: a modal first whatever the numbers, then higher priority, then the one raised earlier. Banners show one at a time.
- **No default expiry**: a notification expires only if its sender says so.
- **Guests are recipients in a table of their own**: `notificationGuestRecipient` has the columns of `notificationRecipient` keyed by guest session, and the merge moves rows into the user's table (earliest delivered and viewed, latest acknowledged, dismissed and shown). Changing the user table's key to admit guests would not be applied to an existing site by the additive schema sync.
- **Dedupe re-opens**: a repeat of `(owner, dedupeKey)` updates one row in place (type, priority and the rest too) and resets all of the new recipients' state, so a repeating failure is one notification at the top, not a flood. Earlier recipients not in the new call are untouched.
- **Actions are data, not code**: a link or an API call to a same-site path. Core never executes an action; the browser calls it as the person and the extension's route does its own permission checks. Paths are validated at creation (single leading `/`, no whitespace, backslashes or control characters) and again in the browser. A link acknowledges the notification and goes there; a call acknowledges it only if it succeeded.
- **Title and message are plain text** and rendered as text.
- **Dismiss is per person and keeps history**; delete for everyone is SDK-only. History is kept until the retention (`system:notification_retention_days`, default 90, 0 = forever) or `expiresAt`, pruned lazily at most hourly on creation.
- **Polling, not a websocket**: the client asks on page load, on focus and visibility, and every `system:notification_poll_seconds` (default 10, at least 1, 0 for load and focus only).
- **The history page is public**: `/notifications/` is open to guests, because `/account` needs a login.
- **Hook name** follows the `area:event` convention: `notification:created`.

## Implementation

### Location
`server/utils/notifications/*`, `server/db/schema.js`, `server/db/upgrades/4.15.0-notification-state-timestamps.js`, `src/kempo/api/notifications/**`, `src/kempo/notifications/client.js`, `src/kempo/components/Notification{Bell,List,History,Inline}.js`, `src/kempo/pagebuilder/coreWidgets.js`, `src/admin/notifications/index.page.html`, `app-public/notifications/index.page.html`.

### Tables
`notification(id, owner, type, subtype, title, message, level, priority, mustAcknowledge, cooldownSeconds, displaySeconds, actions jsonb, dedupeKey, createdAt, updatedAt, expiresAt)` with a partial unique index on `(owner, dedupeKey)` where `dedupeKey` is not null; `notificationRecipient(notificationId, userId, deliveredAt, viewedAt, acknowledgedAt, dismissedAt, lastShownAt)` and `notificationGuestRecipient(notificationId, guestSessionId, ...the same)`, each with a composite primary key and cascading deletes from both parents. `level` is kept for older readers (the subtype when it is one of the four levels).

### Server SDK
`createNotification`, `getNotifications`, `getPendingNotifications`, `getUnreadCount`, `markDelivered`, `markShown`, `markViewed`, `markAllViewed`, `markAcknowledged` (with `markRead`, `markAllRead` and `markHandled` as the older names), `deleteNotification`, `pruneNotifications`, `getNotificationConfig`, `resolveRecipient`. See [docs/notifications.md](../../docs/notifications.md).

### HTTP
`GET /kempo/api/notifications`, `GET .../pending`, `GET .../count`, `POST .../read-all`, `POST .../delivered`, `POST .../:id/shown`, `POST .../:id/viewed`, `POST .../:id/acknowledge`, `DELETE .../:id`. A login or a guest cookie is required; only the caller's own rows are reachable.

### Tests
`tests/notifications.node-test.js` (SDK), `tests/notification-types.node-test.js` (types, guests, status, pending, cooldown, priority), `tests/notifications-http.node-test.js` (HTTP contract and permissions, integration tier), `tests/notifications.browser-test.js` (the client, bell, list, history and inline element in a real browser).
