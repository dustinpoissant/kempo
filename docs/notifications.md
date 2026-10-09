# Notifications

Notifications tell a signed-in user that something happened that they may want to act on: a thumbnail failed to generate, a backup finished, an order needs review. Each person keeps their own read state and a history they can browse, and a notification can carry buttons that link somewhere or call an API.

Kempo core and extensions raise them with `createNotification` from the [Server SDK](extensions/sdk.md#notifications). The admin shell shows a bell with an unread count and a full history page at `/admin/notifications`; a public site can use the same bell with one element.

## Upgrading an existing site

Notifications add two tables, `notification` and `notificationRecipient`. Kempo only creates tables when a site is first set up, so apply them to an existing site the way you apply any kempo schema change:

```bash
npx drizzle-kit push
```

The retention setting `system:notification_retention_days` (default 90) works without being seeded, because the default is built in. Run `node scripts/init-db.js` if you want it listed on the Settings page.

## Raising a notification

```javascript
import { createNotification } from 'kempo/server/sdk.js';

const [error, result] = await createNotification({
  owner: 'my-extension',
  title: 'Thumbnail failed: cover.png',
  message: 'ffmpeg exited with code 1.',
  level: 'error',
  permission: 'my-extension:thumbnails:manage',
  dedupeKey: `thumb:${fileId}`,
  actions: [
    { label: 'Try again', api: { method: 'POST', url: '/kempo/api/my-extension/retry', body: { id: fileId } } },
    { label: 'Open file', href: `/admin/files?id=${fileId}` }
  ]
});
```

| Field | Meaning |
|---|---|
| `owner` | Required. Your extension's name, or `kempo` for core. |
| `title` | Required, up to 200 characters. Plain text. |
| `message` | Optional, up to 2000 characters. Plain text. |
| `level` | `info` (default), `success`, `warning` or `error`. Sets the icon and colour. |
| `actions` | Up to 3 buttons, see below. |
| `dedupeKey` | Makes `(owner, dedupeKey)` one notification that is refreshed, see below. |
| `expiresAt` | A future date after which it is hidden and then deleted. |
| `userIds`, `permission`, `group` | Who receives it. At least one is required; the recipients are their union. |

Title and message are **plain text**. The UI renders them as text, so markup in them is shown, not run.

### Who receives it

- `userIds`: those users. Ids that do not exist are ignored.
- `permission`: everyone who holds it through any group, plus every member of `system:Administrators`, who hold every permission.
- `group`: every member of that group.

A notification whose targets resolve to nobody is not an error: nothing is stored, no hook fires, and the result is `{ notification: null, recipientIds: [] }`.

**Recipients are fixed when the notification is created.** One row is written per recipient, so each person's read, handled and dismissed state is their own and nobody else's read can hide it from them. It also means a person who later loses the permission keeps what they were sent, and a person who gains it later is not handed the past. The cost is a row per recipient for a broadcast, which is small next to how rarely notifications are raised.

### Dedupe

A `dedupeKey` stops a repeating event from flooding people. Raising the same `(owner, dedupeKey)` again does not create a second notification; it updates the existing one in place (title, message, level, actions, expiry), moves it to the top of the list, and **re-opens it for every recipient of the new call**: unread, no longer handled, no longer dismissed. That covers both cases the same way:

- It was still unread: it stays unread, now showing the latest content.
- It had been read, handled or dismissed: it comes back unread, because it is a new occurrence.

People who received the earlier one but are not recipients this time are left exactly as they were. `createdAt` stays the time it was first raised and `updatedAt` is when it was last raised. Without a `dedupeKey` every call is a separate notification. The key belongs to its owner, so two extensions can use the same key.

When the thing is resolved by other means, call `markHandled({ owner, dedupeKey })` to close it for everyone who has it.

## Actions

An action is a button with a `label` and either a link or an API call. Both URLs must be **a path on this site**: they must begin with a single `/` and may not contain whitespace, control characters or backslashes. `https://...`, `//host/...`, `javascript:` and relative paths are rejected when the notification is created, and the browser components check again before rendering or following anything, so a notification can never send someone off-site.

```javascript
{ label: 'Open file', href: '/admin/files?id=7' }
{ label: 'Try again', api: { method: 'POST', url: '/kempo/api/my-extension/retry', body: { id: 7 } } }
```

`api.method` is `POST`, `PUT`, `PATCH` or `DELETE`; `body` is optional JSON of at most 4 KB.

**An API action is only ever fetched by the browser, as the logged-in user.** When the user clicks the button the notification component calls `fetch(url, { method, body })` with that person's own session cookie. Kempo core never calls the URL, never runs code on behalf of a notification, and never calls it for anyone else. The URL is your extension's own route, and that route must do its own authentication and permission checks exactly as if the user had typed the request, because that is what it is. If the response is not successful the component shows the error and leaves the notification open so the user can try again; if it succeeds the notification is marked handled, which also marks it read and replaces its buttons with "Done".

Treat `body` as visible to the user, and do not put secrets in it.

## Reading and changing state

All functions return `[error, result]`.

| Function | Purpose |
|---|---|
| `createNotification(input)` | Raise one. Returns `{ notification, recipientIds, refreshed }`. |
| `getNotifications({ userId, unreadOnly, limit, offset })` | One person's notifications, newest first, with `total` for the filter and `unread` for everything. `limit` is capped at 100. |
| `getUnreadCount({ userId })` | `{ count }`. |
| `markRead({ userId, notificationId })` | Idempotent; keeps the first read time. 404 if the person is not a recipient. |
| `markAllRead({ userId })` | `{ updated }`. |
| `markHandled({ userId?, notificationId?, owner?, dedupeKey? })` | Marks the action done and the notification read. By id for one person, or by `owner` + `dedupeKey` for every recipient. |
| `deleteNotification({ notificationId, userId })` | Dismiss for one person. It disappears from their list and count; everyone else, and the stored row, are untouched. |
| `deleteNotification({ notificationId, everyone: true })` | Delete it for everyone. Server code only: the HTTP routes never do this. |
| `pruneNotifications({ now?, retentionDays? })` | Delete expired notifications and those last raised before the retention. |

Expired and dismissed notifications are left out of lists and counts.

## Retention

History is kept for `system:notification_retention_days` (a number setting, default 90, `0` keeps it forever). Age is measured from when a notification was last raised. Pruning also removes anything past its `expiresAt`. It runs lazily, at most once an hour, when a notification is created, and you can call `pruneNotifications()` yourself from a schedule.

## Hook

`notification:created` fires after every successful `createNotification` that reached someone, including a dedupe refresh, so an email or push extension can react.

| Event | Data |
|---|---|
| `notification:created` | `{ notification, recipientIds, refreshed }` |

`refreshed` is true when an existing deduped notification was updated. Hooks are awaited in order, so a handler that does slow work (sending email) should start it and return. A handler that throws is logged and does not stop the notification being created.

## HTTP API

All routes require a session (401 otherwise) and act only on the signed-in user's own notifications; another user's notification id is a 404, whatever permissions the caller has. A `userId` in the query or body is ignored.

| Route | Purpose |
|---|---|
| `GET /kempo/api/notifications?unreadOnly=true&limit=20&offset=0` | The list, with `total`, `unread`, `limit`, `offset` |
| `GET /kempo/api/notifications/count` | `{ count }` |
| `POST /kempo/api/notifications/read-all` | Mark everything read |
| `POST /kempo/api/notifications/:id/read` | Mark one read |
| `POST /kempo/api/notifications/:id/handled` | Mark one handled (also reads it) |
| `DELETE /kempo/api/notifications/:id` | Dismiss one for the caller |

The browser SDK (`/kempo/sdk.js`) wraps them as `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markNotificationHandled`, `markAllNotificationsRead` and `dismissNotification`.

## Showing notifications

The admin shell already has a bell in its sidebar and a **Notifications** page with an All / Unread filter, pagination, mark read, mark all read and dismiss.

On a public site, add the bell to a template or fragment:

```html
<script type="module" src="/kempo/components/NotificationBell.js"></script>
<k-notification-bell page-href="/account/notifications"></k-notification-bell>
```

`<k-notification-bell>` shows an unread badge and opens the latest notifications. It checks the count on load, when the window regains focus, when the tab becomes visible and every 60 seconds (`interval` in milliseconds, `0` to turn it off), with no websocket. It renders nothing for a visitor who is not signed in. `page-href` adds a "View all" link; `open-direction` positions the dropdown.

For a full history page use the list directly:

```html
<script type="module" src="/kempo/components/NotificationList.js"></script>
<k-notification-list paginated page-size="20"></k-notification-list>
```

Set `unread-only` to filter, call `refresh()` to reload, and listen for `notifications-change` (`detail: { unread, total }`).
