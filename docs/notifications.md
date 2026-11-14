# Notifications

A notification tells a person that something happened. Server code raises it, and the person's browser shows it on whatever page they land on next, even if they left the page that caused it, or used another device. Each person (a signed-in user or a guest) has their own state and a history they can browse, and a notification can carry buttons that link somewhere or call an API.

It is how a password change can say "Password changed" after the form redirects, how an outage can show a banner on every page, how a new terms of use can demand acknowledgement, and how an extension can tell a person a chat message arrived while they were away.

Kempo core and extensions raise them with `createNotification` from the [Server SDK](extensions/sdk.md#notifications). A small script (the notification client) asks the server what to show and draws it.

## Upgrading an existing site

Kempo adds the new columns and tables when the server starts, and moves what was recorded as read and handled over to viewed and acknowledged (`4.15.0-notification-state-timestamps`). Restart the server once after updating.

A **public** site needs one line to show toasts, banners and modals: the notification client, loaded once per page, in its template.

```html
<script type="module" src="/kempo/notifications/client.js"></script>
```

New sites have it in `default.template.html`, and the admin has it already. A template you never edited gets it with the update (see [Starter files](updates.md#starter-files)), and so does the bell in the navigation. A template you have edited is kept as it is, so add the line before `<location name="scripts" />` yourself, and add the bell from the Menus page (it is offered there as the Notification bell). Without it a site still has the bell, the list and the history, but toasts, banners and modals are not drawn.

## Raising a notification

```javascript
import { createNotification } from 'kempo/server/sdk.js';

await createNotification({
  owner: 'kempo',
  type: 'toast',
  subtype: 'success',
  title: 'Password changed',
  userIds: [userId]
});
```

| Field | Meaning |
|---|---|
| `owner` | Required. Your extension's name, or `kempo` for core. |
| `title` | Required, up to 200 characters. Plain text. |
| `message` | Optional, up to 2000 characters. Plain text. |
| `type` | How it is shown. `notice` (default), `toast`, `banner`, `modal`, `inline`, or any word of your own. See [Types](#types). |
| `subtype` | Refines the type. `success`, `error`, `warning` and `info` colour kempo's own types; any other word is yours. `level` is the older name for it. |
| `priority` | A whole number, `0` by default. Higher is shown first. |
| `mustAcknowledge` | `true` keeps it coming back until the person acknowledges it. A `modal` always must. |
| `cooldownSeconds` | How long to wait before showing a `mustAcknowledge` notification again. Defaults to `system:notification_cooldown_seconds`. |
| `displaySeconds` | How long a toast stays up. Defaults to `system:notification_toast_seconds`. |
| `actions` | Up to 3 buttons, see [Actions](#actions). |
| `dedupeKey` | Makes `(owner, dedupeKey)` one notification that is refreshed, see [Dedupe](#dedupe). |
| `expiresAt` | A future date after which it is hidden and then deleted. Without one it does not expire. |
| `userIds`, `guestSessionIds`, `permission`, `group` | Who receives it. At least one is required; the recipients are their union. |

Title and message are **plain text**. The UI renders them as text, so markup in them is shown, not run.

### Who receives it

- `userIds`: those users. Ids that do not exist are ignored.
- `guestSessionIds`: those [guests](guests.md), visitors who have not logged in. Guests that do not exist, or have already logged in to an account, are ignored. Send to the account instead.
- `permission`: everyone who holds it through any group, plus every member of `system:Administrators`, who hold every permission.
- `group`: every member of that group.

A notification whose targets resolve to nobody is not an error: nothing is stored, no hook fires, and the result is `{ notification: null, recipientIds: [], guestSessionIds: [] }`.

**Recipients are fixed when the notification is created.** One row is written per recipient, so each person's state is their own. A person who later loses the permission keeps what they were sent, and a person who gains it later is not handed the past. The cost is a row per recipient for a broadcast.

A notification sent to a guest follows them when they log in or register: it moves to their account with its state (see [Guest sessions](guests.md)). A request that comes from a page can pass the guest's id (`request.guest.token`) as `guestSessionIds`, so a form's backend can leave a message for a visitor who is not logged in.

## Types

The type decides how the browser shows it. Kempo draws five. Any other word is an extension's own type, which core ignores and the extension's own component handles, so extensions need no registration to make one.

| Type | Where | X | Button | Counts as viewed | Comes back |
|---|---|---|---|---|---|
| `toast` | A pop-up over the page | Dismisses | Acknowledges | After it has been up for its time | Not once viewed. Leaving the page early does not view it, so it shows again on the next page for its full time. |
| `banner` | At the top of the page content, one at a time | Dismisses | Acknowledges | After it has been on screen for the banner time | On every page until viewed. The next banner takes its place once this one is viewed. |
| `notice` | The bell in a menu, and the history | Dismisses | Acknowledges (a button may also go somewhere, such as a new terms page) | One second after the bell is opened with it on screen | It stays until dismissed or expired. |
| `modal` | A blocking dialog, shown before anything else | None | Required: acknowledges | When acknowledged | Every page, after its cooldown, until acknowledged. |
| `inline` | Where a page places `<k-notification-inline>` | Dismisses | Acknowledges | After it has been on screen for the banner time | Until viewed. A page without the element leaves it for one that has it. |

- A **toast** shows its first action, or an "Okay" when it must be acknowledged. One that must be acknowledged does not time out.
- A **modal** has no X, no click-outside and no Escape: its buttons (or an "Okay") are the only way out.
- A person who dismisses a toast, banner or inline message never sees it again, but it stays in their [history](#history).
- Priority orders them: a modal is always first, then higher priority, then the one raised earlier. Notices list by priority in the bell.

### Your own types

```javascript
await createNotification({
  owner: 'my-chat',
  type: 'chat',
  subtype: 'afk-message',
  title: 'Sam sent you a message',
  userIds: [recipientId],
  expiresAt: new Date(Date.now() + 3600000)
});
```

The browser gives every type it does not draw to whatever has subscribed to it. Your component asks the client for them and reports what the person did:

```javascript
import { subscribe } from '/kempo/notifications/client.js';

const stop = subscribe('chat', (notification, controls) => {
  badge.count += 1;
  badge.onOpen = () => controls.viewed();
  badge.onDismiss = () => controls.dismiss();
});
```

`controls` has `shown()`, `viewed()`, `acknowledge()`, `dismiss()`, `run(action, onError)` (carries out one of the notification's actions) and `settings`. The handler is called for what is pending when it subscribes as well as for what arrives later. A type nobody has subscribed to is left alone, and is not reported as delivered, until a page that has a subscriber loads. Do the work in your own component; core never draws a type it does not know.

## Status

A person's state is a set of timestamps, and the status is worked out from them, so it cannot disagree with them: dismissed, acknowledged, viewed, delivered, or pending, in that order of precedence.

| Status | Meaning |
|---|---|
| `pending` | Created, but no browser has fetched it. |
| `delivered` | A browser fetched it (`deliveredAt`). |
| `viewed` | It was on screen for long enough (`viewedAt`). |
| `acknowledged` | The person confirmed it: pressed its button (`acknowledgedAt`). |
| `dismissed` | The person hid it (`dismissedAt`). It stays in their history. |
| `expired` | Its `expiresAt` has passed. By the clock, not the person. |

`lastShownAt` is when it was last put in front of the person, which is what the cooldown counts from. Each time keeps the **first** time it happened, except `lastShownAt`, and viewing, showing or acknowledging a notification also delivers it. Acknowledging also views it.

## mustAcknowledge

For something the person must act on: new terms, a suspended account, a friend request. It works on any type. It is shown, and shown again, until acknowledged or expired, but not more often than its cooldown:

- Viewing it does not stop it. Only acknowledging does.
- The wait is `cooldownSeconds` on the notification, or `system:notification_cooldown_seconds` (180). A terms update might use 60 seconds; a friend request might use 86400 (once a day).
- A toast that must be acknowledged stays up until acknowledged or dismissed.
- A page load or a poll shows it only if its cooldown has passed since it was last shown.

## Expiry

`expiresAt` is optional, and without it a notification never expires. One that has expired is hidden from the person's lists, and is deleted by the retention pruning. A notification about an edited comment should expire in minutes, so it is not delivered a week later.

## Dedupe

A `dedupeKey` stops a repeating event from flooding people. Raising the same `(owner, dedupeKey)` again does not create a second notification; it updates the existing one in place (title, type, subtype, priority, expiry and the rest), moves it to the top, and **re-opens it for every recipient of the new call**: not delivered, viewed, acknowledged or dismissed, and not shown. People who received the earlier one but are not recipients this time are left exactly as they were. `createdAt` stays the time it was first raised and `updatedAt` is when it was last raised. Without a `dedupeKey` every call is a separate notification. The key belongs to its owner, so two extensions can use the same key.

When the thing is resolved by other means, call `markAcknowledged({ owner, dedupeKey })` to close it for everyone who has it, guests included.

## Actions

An action is a button with a `label` and either a link or an API call. Both URLs must be **a path on this site**: they must begin with a single `/` and may not contain whitespace, control characters or backslashes. `https://...`, `//host/...`, `javascript:` and relative paths are rejected when the notification is created, and the browser components check again before rendering or following anything, so a notification can never send someone off-site.

```javascript
{ label: 'Open file', href: '/admin/files?id=7' }
{ label: 'Try again', api: { method: 'POST', url: '/kempo/api/my-extension/retry', body: { id: 7 } } }
```

`api.method` is `POST`, `PUT`, `PATCH` or `DELETE`; `body` is optional JSON of at most 4 KB.

**An API action is only ever fetched by the browser, as the person.** When they press the button the browser calls `fetch(url, { method, body })` with their own cookies. Kempo core never calls the URL, never runs code on behalf of a notification, and never calls it for anyone else. The URL is your extension's own route, and that route must do its own authentication and permission checks exactly as if the person had typed the request, because that is what it is. If the response is not successful the notification shows the error and stays open so the person can try again; if it succeeds the notification is acknowledged. A link acknowledges the notification and goes there.

Treat `body` as visible to the person, and do not put secrets in it.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `system:notification_poll_seconds` | 10 | Seconds between the browser asking for new notifications, at least 1. `0` asks only when a page loads or the window is focused. The browser always asks the moment a page loads, and again when the window is focused or the tab becomes visible. |
| `system:notification_cooldown_seconds` | 180 | The wait before a `mustAcknowledge` notification is shown again, unless it sets `cooldownSeconds`. |
| `system:notification_toast_seconds` | 10 | How long a toast is up before it counts as viewed, unless it sets `displaySeconds`. |
| `system:notification_banner_seconds` | 10 | How long a banner or inline message must be on screen before it counts as viewed. |
| `system:notification_retention_days` | 90 | How long history is kept (0 forever). |

## History

History is kept for `system:notification_retention_days` (a number setting, default 90, `0` keeps it forever). Age is measured from when a notification was last raised. Pruning also removes anything past its `expiresAt`. It runs lazily, at most once an hour, when a notification is created, and you can call `pruneNotifications()` yourself from a schedule.

A person can see their history, the notifications they dismissed included, with `<k-notification-history>`, the page at `/notifications/` and the Notification history page builder widget.

## Reading and changing state

All functions return `[error, result]`. Anything that acts for one person takes `{ userId }` or `{ guestSessionId }`.

| Function | Purpose |
|---|---|
| `createNotification(input)` | Raise one. Returns `{ notification, recipientIds, guestSessionIds, refreshed }`. |
| `getNotifications({ userId, guestSessionId, type, status, unreadOnly, limit, offset })` | One person's notifications, highest priority first and then newest, with `total` for the filter and `unread` for the `type`. `status` is `active` (the default: not dismissed or expired), `all`, or one status. `limit` is capped at 100. |
| `getPendingNotifications({ userId, guestSessionId })` | What a browser should show now (see [How the browser asks](#how-the-browser-asks)). A read that changes nothing. |
| `getUnreadCount({ userId, guestSessionId, type })` | `{ count }` of what has not been viewed. |
| `markDelivered({ ..., notificationIds })` | A browser fetched these. |
| `markShown({ ..., notificationId })` | It was put in front of the person: starts the cooldown, and delivers it. |
| `markViewed({ ..., notificationId })` | Idempotent; keeps the first time. 404 if the person is not a recipient. |
| `markAllViewed({ ..., type })` | `{ updated }`, of one `type` or all. |
| `markAcknowledged({ userId?, guestSessionId?, notificationId?, owner?, dedupeKey? })` | The action was taken; also views and delivers it. By id for one person, or by `owner` and `dedupeKey` for every recipient. |
| `deleteNotification({ notificationId, userId, guestSessionId })` | Dismiss for one person. It leaves what they have but stays in their history; everyone else, and the stored row, are untouched. |
| `deleteNotification({ notificationId, everyone: true })` | Delete it for everyone. Server code only: the HTTP routes never do this. |
| `pruneNotifications({ now?, retentionDays? })` | Delete expired notifications and those last raised before the retention. |
| `getNotificationConfig()` | The four settings above. |
| `resolveRecipient({ sessionToken, guestToken })` | Whose notifications a request is for: a login first, then a guest, otherwise a 401. |

`markRead`, `markAllRead` and `markHandled` are the older names of `markViewed`, `markAllViewed` and `markAcknowledged`, kept for extensions written before notifications had types.

## Hooks

`notification:created` fires after every successful `createNotification` that reached someone, including a dedupe refresh, so an email or push extension can react.

| Event | Data |
|---|---|
| `notification:created` | `{ notification, recipientIds, guestSessionIds, refreshed }` |

`refreshed` is true when an existing deduped notification was updated. Hooks are awaited in order, so a handler that does slow work (sending email) should start it and return. A handler that throws is logged and does not stop the notification being created.

## How the browser asks

The notification client is one module, `/kempo/notifications/client.js`. Loaded once per page, it asks `GET /kempo/api/notifications/pending` the moment the page loads and then every `system:notification_poll_seconds`, and again when the window is focused or the tab becomes visible (no websocket). It also gets the settings and the count of unviewed notices, so one request serves the page and the bell.

`pending` is everything that is not a notice, and is not dismissed, acknowledged or expired, and is either not yet viewed or must be acknowledged and is past its cooldown, in order: modals, then priority, then the one raised earliest. The client draws toasts, banners and modals itself and hands everything else to the components that subscribed (`<k-notification-inline>`, an extension's own). It reports what happened as it happens, with `delivered`, `shown`, `viewed`, `acknowledge` and dismiss requests.

- A toast is **viewed** when it times out. A person who navigates away first has not seen it, so it shows again for its full time on the next page.
- A banner or inline message is **viewed** after the banner time on screen, counting only time the page is visible.
- A request with no login and no guest gets a 401, and the bell hides.

## HTTP API

Each route works for a signed-in person or a guest, using the login cookie first and then the guest cookie, and acts only on the caller's own notifications; another person's notification id is a 404, whatever permissions the caller has. A `userId` in the query or body is ignored. A request with neither cookie is a 401.

| Route | Purpose |
|---|---|
| `GET /kempo/api/notifications?status=&type=&unreadOnly=&limit=&offset=` | The list, with `total`, `unread`, `limit`, `offset`. An unknown `status` or `type` is a 400. |
| `GET /kempo/api/notifications/pending` | What to show now, with `config` (`pollSeconds`, `cooldownSeconds`, `toastSeconds`, `bannerSeconds`) and `unreadNotices`. Never cached. |
| `GET /kempo/api/notifications/count?type=` | `{ count }` of unviewed |
| `POST /kempo/api/notifications/delivered` | `{ ids }` were fetched |
| `POST /kempo/api/notifications/read-all` | Mark everything viewed (`{ type }` for one type) |
| `POST /kempo/api/notifications/:id/shown` | It was put in front of the person |
| `POST /kempo/api/notifications/:id/viewed` | Mark one viewed |
| `POST /kempo/api/notifications/:id/acknowledge` | Mark one acknowledged (also views it) |
| `DELETE /kempo/api/notifications/:id` | Dismiss one for the caller |

The browser SDK (`/kempo/sdk.js`) wraps them as `getNotifications`, `getPendingNotifications`, `getUnreadNotificationCount`, `markNotificationsDelivered`, `markNotificationShown`, `markNotificationViewed`, `markNotificationAcknowledged`, `markAllNotificationsViewed` and `dismissNotification`. The SDK keeps a read for a few seconds, so the notification client polls with its own `fetch`.

## Showing notifications

### The client

Add it once to a template and every page shows toasts, banners and modals. Nothing else is needed. See [Upgrading an existing site](#upgrading-an-existing-site).

### The bell

```html
<script type="module" src="/kempo/components/NotificationBell.js"></script>
<k-notification-bell page-href="/notifications/"></k-notification-bell>
```

`<k-notification-bell>` shows a badge of the notices a person has not viewed and opens them. It works for signed-in people and for guests, and renders nothing until the server has answered, or when there is no one to answer for. It has no timer of its own: the count comes from the client. Opening it shows the notices, and one second later the ones on screen count as viewed. `page-href` adds a "View all" link; `open-direction` positions the dropdown; `button-class` adds classes to the trigger button.

New sites have it in the public navigation, and the admin sidebar has its own.

### The list and the history

```html
<script type="module" src="/kempo/components/NotificationList.js"></script>
<k-notification-list type="notice" paginated page-size="20"></k-notification-list>

<script type="module" src="/kempo/components/NotificationHistory.js"></script>
<k-notification-history></k-notification-history>
```

`<k-notification-list>` takes `type` (only that kind), `status` (`active` by default, `all` for a history, or one status), `show-status` (names each one's status), `unread-only`, `page-size`, `paginated` and `compact`. Call `refresh()` to reload and `viewVisible()` to mark what is on screen as viewed; it fires `notifications-change` (`detail: { unread, total }`).

`<k-notification-history>` is the list with a choice of kind and status, starting on everything, dismissed ones included. New sites have it at `/notifications/`, open to guests too (`/account` is for people who are signed in). It is also a widget in the page builder.

### Messages in a page

```html
<script type="module" src="/kempo/components/NotificationInline.js"></script>
<k-notification-inline subtype="error"></k-notification-inline>
```

`<k-notification-inline>` is where `inline` notifications appear: at the top of a form, say, for a message that has to survive the redirect that follows it. `subtype` shows only that subtype. It is also a page builder widget.

### The page builder

The notification bell, list, history and messages are widgets in the page builder's Account group, so none of this needs code.
