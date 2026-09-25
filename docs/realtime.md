# Realtime

Kempo can push messages to browsers as they happen: a payment changes status, an order ships, a background job finishes. Extensions publish to a **channel**, and every signed-in browser subscribed to that channel receives the message, on whichever kempo process it is connected to.

It is built on WebSockets and a Postgres `LISTEN`/`NOTIFY` bus, so it needs no extra service: if you can run kempo, you can run realtime.

Requires `kempo-server` 3.4.0 or later.

## Quick start for extension authors

**1. Declare a channel** in your extension's `kempo-config.json`, next to the permission that guards it:

```json
{
  "permissions": [
    { "name": "my-ext:orders:read", "description": "See live order updates" }
  ],
  "realtime": {
    "channels": [
      { "name": "orders", "permission": "my-ext:orders:read", "persist": true, "retention": "24h" }
    ]
  }
}
```

The channel's full name is `<extension-name>:<name>`, so this one is `my-ext:orders`.

**2. Publish** from any server code, such as a webhook handler or a route:

```javascript
import { realtime } from 'kempo/server/sdk.js';

const [error, result] = await realtime.publish({
  channel: 'my-ext:orders',
  data: { id: 'order_123', status: 'shipped' }
});
```

**3. Subscribe** in the browser:

```javascript
import { connect } from '/kempo/realtime.js';

const realtime = connect();

const stop = realtime.subscribe('my-ext:orders', (data, { id }) => {
  updateRow(data.id, data.status);
}, {
  onGap: () => reloadTheWholeList()
});
```

That is the whole loop. The rest of this page is what to know before relying on it.

## Channels

A channel is named `<owner>:<name>`. The owner is an extension's package name (`kempo` for core), so two extensions cannot collide and a channel always says who is responsible for it.

**Channels are closed by default.** A channel must have a permission (or an `authorize` function) before anyone can subscribe to it. A declared channel with no `permission` is treated as if it did not exist.

**Every user has a private channel**, `user:<their user id>`. Only that user can subscribe to it, and it needs no declaration. Use it to send something to one person:

```javascript
await realtime.publish({ channel: `user:${userId}`, data: { notice: 'Your export is ready' } });
```

Disabling an extension closes its channels, since they are read from the stored extension config.

### Declaring a channel in code

Extensions should use `kempo-config.json`. Application code can register a channel instead:

```javascript
import { realtime } from 'kempo/server/sdk.js';

realtime.registerChannel({
  owner: 'my-app',
  name: 'announcements',
  permission: 'my-app:announcements:read',   // and/or: authorize: async ({ user, channel }) => boolean
  persist: false
});
```

`registerChannel` returns `[error, { channel }]` and refuses a name that is invalid, unguarded, or already taken. If both `permission` and `authorize` are given, both must allow. An `authorize` that throws is a refusal, not an open door.

**Only register at startup.** Nothing runs before the first subscriber connects, so a registration made inside a lazily loaded route file might not exist yet when someone subscribes. A file listed under `middleware.custom` in your server config is loaded at startup and is a safe place. A declaration in `kempo-config.json` has no such constraint, which is why extensions should use it.

## Delivery guarantees

| | Channel that does not persist (default) | Channel with `persist: true` |
|---|---|---|
| Delivery | Live only, at most once | Stored, so a client can catch up |
| Message ids | None | Yes, ascending within the channel |
| Size limit | About 7,900 bytes | 1,000,000 bytes |
| Missed messages | Lost if a client was offline | Replayed on reconnect, within retention |

**Persisted channels** write every message to the `realtimeMessage` table before delivering it. A client that reconnects passes the last id it saw as `since`, and receives what it missed, in order, before live messages resume, with nothing dropped or repeated at the join. The bundled browser client does this for you.

**Retention** (default 24 hours, per channel) says how long messages are kept. A client that asks for messages older than that gets a `gap` frame instead, which means "you missed some and they are gone": refetch the full state rather than trusting the stream. This is what `onGap` is for.

**A message that is too large** for a channel that does not persist is refused with a `413` and a message saying to send less or turn on `persist`. That limit is Postgres's, not kempo's.

**Ordering** within a channel is guaranteed. Publishes on one channel are serialized, and a subscriber sees them in the order they committed.

If the database connection that listens for messages drops, it reconnects on its own. Persisted channels are made whole again from the table; anything published on a non-persisted channel while it was down is lost, which is the guarantee that kind of channel makes.

## The browser client

`/kempo/realtime.js` handles connecting, reconnecting and resuming, since a browser does not reconnect a WebSocket that closes.

```javascript
import { connect } from '/kempo/realtime.js';

const realtime = connect();                 // opens the socket immediately
```

`connect(options)` accepts `url` (defaults to this site's `/kempo/api/realtime`), `backoff: { base, max }` in milliseconds (default 1000 and 30000), and `WebSocket`, `checkSession` and `random` for testing.

### `realtime.subscribe(channel, handler, options)`

Returns a function that stops the subscription. `handler(data, { channel, id })` is called for each message; `id` is only present on persisted channels. Several handlers can share one channel, and the server is told only when the first arrives and the last leaves.

| Option | |
|---|---|
| `since` | Resume from this message id, for a caller that remembers the last id it processed across page loads |
| `onGap` | Called with `{ channel }` when messages were pruned before the client could get them |
| `onError` | Called with `{ channel, code, msg }` if the server refuses, for example a `403` |

A handler that throws does not stop other handlers or later messages. A refused channel is not retried on reconnect, since it would only be refused again.

### Status

`realtime.status` is one of:

| Status | Meaning |
|---|---|
| `connecting` | First connection attempt |
| `open` | Connected |
| `reconnecting` | Lost the connection; trying again with backoff |
| `unauthenticated` | The session ended; the client has stopped and will not retry |
| `closed` | `realtime.close()` was called |

`realtime.onStatus(fn)` reports changes, `realtime.userId` and `realtime.onReady(fn)` give the signed-in user's id, and `realtime.close()` stops it for good.

A server restart reconnects almost immediately. Any other failure retries with growing, jittered delays, and first asks whether the session is still valid so that signing out does not turn into an endless retry loop.

## Wire protocol

For a client that is not the bundled one. Connect to `/kempo/api/realtime` with the session cookie; frames are JSON text.

| Direction | Frame |
|---|---|
| Client to server | `{ "type": "subscribe", "channel": "my-ext:orders", "since": 42 }` (`since` optional) |
| Client to server | `{ "type": "unsubscribe", "channel": "my-ext:orders" }` |
| Server to client | `{ "type": "ready", "userId": "…" }` on connect |
| Server to client | `{ "type": "subscribed", "channel": "…" }` |
| Server to client | `{ "type": "message", "channel": "…", "id": 43, "data": … }` |
| Server to client | `{ "type": "gap", "channel": "…" }` |
| Server to client | `{ "type": "error", "channel": "…", "code": 403, "msg": "…" }` |

A malformed frame gets an `error` frame and the connection stays open. Close code `4401` means the session ended and the client should not reconnect.

## Security

- **Authentication** is the same session cookie the rest of kempo uses, checked when the socket connects. No session is a `401` before any socket exists.
- **Cross-site protection.** Browsers apply no same-origin policy to WebSockets, so without a server-side check any website could open a socket as the signed-in user. kempo-server refuses a handshake from another origin by default. Only widen it deliberately, with `websocket.allowedOrigins` in your server config.
- **Authorization** is checked when a client subscribes. A permission granted or revoked later does not change a subscription that already exists.
- **A socket cannot outlive its session.** Sessions behind open sockets are re-checked every 30 seconds, and a socket whose session has ended (signed out, expired, revoked) is closed with `4401`.
- **Session tokens** are never exposed, including in the admin view.

## Admin

**Admin, then Realtime** lists the connections held by the process that answered the request (user, path, channels, when they connected, last activity) and how many subscribers each channel has. It needs the `system:realtime:read` permission, which the Administrators group has.

It shows one process only. Sockets are held by the process that accepted them, so with several processes behind a load balancer the page shows whichever one served your request. Messages still reach every process.

## Configuration

| Environment variable | Default | |
|---|---|---|
| `KEMPO_REALTIME_SESSION_CHECK_MS` | `30000` | How often open sockets' sessions are re-checked |
| `KEMPO_REALTIME_PRUNE_MS` | `600000` | How often expired persisted messages are deleted |

Socket options such as the maximum message size, the origin allow-list and the heartbeat belong to kempo-server; see its `websocket` configuration.

## Upgrading

1. Update to a kempo that includes realtime, with `kempo-server` 3.4.0 or later.
2. **Create the tables.** Realtime adds `realtimeMessage` and `realtimeChannel`. Apply them the way you apply any kempo schema change (`drizzle-kit push`, or generate and migrate).
3. **Seed the permission.** Run `node node_modules/kempo/scripts/init-db.js` to create `system:realtime:read` and grant it to Administrators. It is safe to run again. Administrators can already use the admin page before this, since that group passes every permission check; it matters for granting the permission to other groups.

## Deployment notes

- **Connection poolers.** Realtime holds one dedicated connection that stays in `LISTEN`. That does not work through a pooler in transaction mode, such as PgBouncer. Point kempo at Postgres directly, or use session pooling.
- **Several processes** need nothing extra. They share one database and therefore one bus.

## Not included

- **Presence** ("who is online") is not part of realtime.
- **Clients cannot publish.** They subscribe; only server code publishes.
- **A slow client** still queues messages in memory on the server. That is fine for status-style updates and worth knowing before using realtime for high-rate streams.
