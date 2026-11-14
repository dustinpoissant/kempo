# Guests

## Description
A cookie-tracked visitor who has not logged in, kept as a session so what they own before logging in can move to their account when they do.

## Dependencies
- [Database](../concepts/db.md) — `guestSession` and `notificationGuestRecipient` tables
- [Users](users.md), [Sessions](sessions.md) — a guest merges into a user at login or registration
- [Hooks](hooks.md) — fires `guest:merged` and `guest:expired`
- [Settings](settings.md) — `system:guest_session_days`, `system:guest_idle_days`
- [Permissions](permissions.md) — `system:guests:view`, `system:guests:manage`
- [Notifications](notifications.md) — a guest can be sent a notification

## Context
Some things should work before a visitor has an account: a notification after a form, a cart, a comment. Giving the visitor a real account first would put junk in the user table and risk a guest passing a login check. This keeps the guest a separate kind of thing that is never logged in, and hands what it owns to the real account when there is one.

### Decisions
- **A session, not a user row**: `guestSession` is its own table, with its own cookie `kempo_guest`. `request.guest` is separate from the login session, so every login and permission check is unchanged and a guest can never satisfy one.
- **Created on a page request**: only a GET that asks for HTML starts a guest, and not for someone already logged in. A file, an API call or a script with no cookie does not leave a row.
- **Login and registration merge identically**: the account may be ten years old or ten seconds old, and it holds what the visitor did before. Registration that needs email verification merges later, at the first login, because nobody is logged in yet.
- **The merge is one transaction and a failing hook undoes it**: kempo moves its own rows, then `guest:merged` fires with `{ tx, guestSessionId, userId }`. A throwing handler rolls everything back and the login is refused, with the guest and its cookie kept so the visitor can try again.
- **Extensions own their guest rules**: kempo supplies the token, the two hooks and the rule that a guest is never a login. Each extension decides what a guest may do and moves its own rows.
- **Hooks are read before the transaction**: the in-process test database runs one transaction at a time, so `planHook` reads the handlers first and `triggerPlannedHook` fires inside it.
- **Merge keeps the user's own state**: for a notification both have, the earliest read and the latest handled and dismissed are kept. Account settings are never overwritten by guest values.
- **Guest recipients are their own table**: `notificationGuestRecipient` mirrors `notificationRecipient` with `guestSessionId`. Changing `notificationRecipient`'s primary key to allow a null user would not be applied to an existing site by the additive schema sync, and would be reported as a failed change.
- **The token is never sent to scripts**: it is the guest's identity, in an `httpOnly` cookie, and `GET /kempo/api/guest` answers with the creation time only.
- **Cleanup is by idle time**: `system:guest_idle_days` (default 60) from the last visit, merged or not; only an unmerged guest announces `guest:expired`, since a merged one owns nothing.

## Implementation

### Location
`server/utils/guests/*`, `server/db/schema.js`, `middleware/kempo.js` (the cookie), `src/kempo/api/auth/login/email/POST.js` and `src/kempo/api/auth/register/email/POST.js` (the merge), `src/kempo/api/guest/GET.js`, `src/kempo/api/admin/guests/**`, `src/admin/accounts/guests/index.page.html`.

### Tables
`guestSession(token pk, createdAt, lastSeenAt, mergedIntoUserId → user set null, mergedAt)`; `notificationGuestRecipient(notificationId, guestSessionId, deliveredAt, viewedAt, acknowledgedAt, dismissedAt, lastShownAt)` with a composite primary key and cascading deletes from both parents.

### Server SDK
`createGuest`, `getGuest`, `mergeGuest`, `mergeGuestIntoLogin`, `deleteGuest`, `listGuests`, `pruneGuests`, `planHook`, `triggerPlannedHook`, `GUEST_COOKIE`. See [docs/guests.md](../../docs/guests.md).

### Scheduler
`guest-cleanup`, daily, runs `pruneGuests`.

### Tests
`tests/guests.node-test.js`: the SDK, the middleware, the login and registration routes, the guest and admin routes.
