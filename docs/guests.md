# Guest sessions

A guest is a visitor who has not logged in, tracked by a cookie. What they do before they log in (a notification they were sent, a form they submitted, a cart) is attached to the guest, and moves to their account the moment they log in or register.

A guest is **a session, not a user**. It is never logged in: `require-login`, permission checks, `/account` and `/admin` all ignore it, and no route treats a guest as a person unless that route asks for the guest explicitly.

## How it works

1. A visitor's first **page request** (a `GET` that asks for HTML, not a file or an API call) starts a guest and sets the `kempo_guest` cookie. A visitor who is already logged in does not get one.
2. Their next visits find the same guest by its cookie. Each visit renews the cookie (at most once a minute).
3. When they log in or register, everything the guest owns moves to the account, the guest cookie is cleared, and the login cookie is set. Registering and logging in behave exactly the same, whatever the age of the account.
4. When they log out they have no cookie, so their next page request starts a new guest.

The response that sets or renews the cookie is sent `Cache-Control: private, no-store`, so a shared cache (a CDN, a proxy) never hands one visitor's guest to another. A site that caches pages publicly still has to let that first response through.

A guest that goes unused is deleted by a daily job. Scripts and crawlers that keep no cookies do not leave rows behind, because only page requests start a guest.

If a registration needs email verification, nobody is logged in yet, so the guest stays until they log in after verifying.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `system:guest_session_days` | 30 | Days the cookie lasts after the last visit. `0` is a cookie that goes when the browser closes. |
| `system:guest_idle_days` | 60 | Days a guest can sit unused before it is deleted. `0` keeps guests forever. |

## Permissions

| Permission | Meaning |
|---|---|
| `system:guests:view` | See the **Guests** page in the admin (Accounts): the list, counts, when each was last seen and which account it went into. |
| `system:guests:manage` | Delete a guest session. |

## Using a guest in your extension

Core does not decide what a guest may do. Each extension decides for its own tables and routes.

In a route (the HTTP layer), `request.guest` is `{ token }` when the request has a valid guest, otherwise it is not set. Pass the token to your server code as a plain string, as `guestSessionId`. Only a page request or a request that already carries a valid cookie has one, so an API route that accepts guests should read `request.guest` and answer 401 itself when it is missing.

```javascript
// src/my-ext/api/cart/POST.js
export default async (request, response) => {
  const guestSessionId = request.guest?.token;
  const userId = (await getSession({ token: request.cookies.session_token }))[1]?.user.id;

  if(!userId && !guestSessionId){
    return response.status(401).json({ error: 'Open the site in a browser first' });
  }
  // ...
};
```

Give each table that can hold a guest's records a nullable `guestSessionId` column that references `guestSession.token` with `onDelete: 'cascade'`, next to its `userId`. When a guest is deleted, those rows go with it.

Never send the guest token to the browser's JavaScript: it is the guest's identity, in an `httpOnly` cookie. `GET /kempo/api/guest` tells a client whether it has a guest and when it was created, without the token.

### Moving a guest's records: `guest:merged`

Records you keep for a guest must move to the user, or the visitor loses them at login. Register a handler for `guest:merged`:

| Event | Data |
|---|---|
| `guest:merged` | `{ tx, guestSessionId, userId }` |

It fires inside the same database transaction as the merge, after kempo has moved its own rows, and kempo waits for every handler. **A handler that throws undoes the whole merge** and the login is refused with a 500, so nothing is half moved. Because of that:

- Do your writes through `tx` (`tx.update(myTable).set({ userId, guestSessionId: null }).where(eq(myTable.guestSessionId, guestSessionId))`), not `db`. Writes through `db` are not part of the transaction and are not undone.
- Do not read through `db` for anything the merge just changed, and keep the handler quick and database-only. Queue slow work and return.
- Handle rows the user already has. If your table is unique on `(userId, thing)`, merge a guest's row into the user's instead of inserting a duplicate.

### After the merge: `guest:merged:committed`

| Event | Data |
|---|---|
| `guest:merged:committed` | `{ guestSessionId, userId, results }` |

Fires after the merge has committed, so it is the place for anything that must only happen once a merge really happened, such as telling the person. `results` is what each `guest:merged` handler returned, as `[{ hookId, owner, result }]`, so a handler can return what it moved for the notice. A merge that is rolled back never fires it. A handler that throws is logged and changes nothing.

### Cleaning up: `guest:expired`

| Event | Data |
|---|---|
| `guest:expired` | `{ tx, guestSessionId }` |

Fires inside the transaction that deletes an unmerged guest (cleanup of an idle guest, or an administrator deleting one), before it is deleted. Remove what you keep for the guest, including files. A handler that throws keeps that guest for the next run and the others are still deleted. A guest that has already been merged owns nothing, so nothing is announced for it. If your rows reference `guestSession.token` with `onDelete: 'cascade'`, the rows go on their own and you only need a handler for files or other data outside the database.

## Worked examples: how extensions use guests

Each case covers what happens when a guest logs in to a **new** account (one just created) and to an **existing** account (one that already has data).

**kempo-credits** (in-game credits). A guest wins credits by playing. Their credits are rows keyed by the guest's token, so the merge rewrites that key to the account id.
- New account: the guest's credits and history move to it. The person gets a notice with the amount.
- Existing account: the guest's credits are added to its balance, and the history is kept under the account. The notice shows only the amount that came over, not the new total.
- A key the account already uses (a retried request before and after login) is renamed on the guest's side, so nothing is refused and the retry still finds its own grant.
- If another extension's handler refuses the merge, the credits stay with the guest and no notice is sent.

**kempo-game** (games and realtime play). A guest plays a game.
- New account: the game history moves to the account.
- Existing account: the guest's games are added to the account's history. Players and games keep their ids.

**kempo-forms** (form submissions). A guest fills in a form.
- New account: the submission is attached to the account and shows in its history.
- Existing account: the submission is added to the account's own submissions.

**kempo-commerce** (cart). A guest fills a cart before logging in.
- New account: the guest's cart becomes the account's cart.
- Existing account: the two carts are combined. Where both hold the same product, quantities are added together.

## What kempo moves itself

Notifications. A notification sent to a guest (`guestSessionIds` of `createNotification`) is a row in `notificationGuestRecipient`, the guest's twin of `notificationRecipient`, with the same state. When the guest logs in it becomes the user's, state and all, so a toast the guest was shown stays shown. A notification the user already had is not duplicated: the earliest delivered and viewed is kept, and the latest acknowledged, dismissed and shown. See [Notifications](notifications.md).

## Server SDK

All return `[error, result]`.

| Function | Purpose |
|---|---|
| `createGuest()` | Start a guest. Returns `{ token, createdAt }`. |
| `getGuest({ token })` | An unmerged guest, renewing its last-seen time at most once a minute. 404 for an unknown or merged one. Returns `{ guest, touched }`. |
| `mergeGuest({ guestSessionId, userId })` | Merge a guest into a user. 404 for an unknown guest or user, 409 if it was already merged, 500 if a handler failed. |
| `mergeGuestIntoLogin({ guestSessionId, userId, sessionToken })` | What the login and registration routes call. Revokes the new login session and returns a 500 only if the merge fails; a guest that is gone or already merged is not an error. Use this when you add another way to log in. |
| `deleteGuest({ token })` | Delete a guest, firing `guest:expired` for an unmerged one. |
| `listGuests({ merged, limit, offset })` | The admin list. |
| `pruneGuests({ days })` | Delete every guest unused for longer than `days` (default `system:guest_idle_days`). |
| `planHook(event)`, `triggerPlannedHook(plan, event, data, options)` | Fire a hook inside a transaction. Read the handlers with `planHook` before the transaction opens, then fire with `triggerPlannedHook` inside it. |

`GUEST_COOKIE` is the cookie's name, `kempo_guest`.

### Adding another way to log in

A login method an extension adds (a social login, a magic link) should merge the guest the same way. After the person is verified and you have created their session, call `mergeGuestIntoLogin`, clear the cookie, and set yours:

```javascript
const guestToken = request.cookies[GUEST_COOKIE];
const [mergeError] = await mergeGuestIntoLogin({ guestSessionId: guestToken, userId, sessionToken });
if(mergeError) return response.status(mergeError.code).json({ error: mergeError.msg });
if(guestToken) response.clearCookie(GUEST_COOKIE, { path: '/' });
```

## HTTP API

| Route | Purpose |
|---|---|
| `GET /kempo/api/guest` | `{ createdAt }` for the caller's guest, or `204` when there is none. Never the token. |
| `GET /kempo/api/admin/guests?merged=&limit=&offset=` | The list with `counts` (needs `system:guests:view`). `merged` is `merged` or `unmerged`. |
| `DELETE /kempo/api/admin/guests/:token` | Delete one (needs `system:guests:manage`). |

## Upgrading an existing site

Guests add two tables, `guestSession` and `notificationGuestRecipient`, the two settings, and the two permissions. Kempo adds all of them when the server starts. Restart the server once after updating.
