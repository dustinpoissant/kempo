# Realtime

Kempo can push messages to browsers as they happen: a payment changes status, an order ships, a background job finishes. Extensions publish to a **channel**, and every signed-in browser subscribed to that channel receives the message, on whichever kempo process it is connected to.

Browsers can also talk back. A client sends a message to a channel, the channel's own **handler** (written by the extension) receives it and can reply, and extensions can react to connections coming and going through **hooks**. Together these are the primitives for anything interactive: chat, collaborative editing, presence, live cursors, a multiplayer game. Kempo ships none of those; it gives an extension the pieces to build them without ever touching a socket.

It is built on WebSockets and a Postgres `LISTEN`/`NOTIFY` bus, so it needs no extra service: if you can run kempo, you can run realtime.

Requires `kempo-server` 3.4.0 or later. The backpressure and connection-limit features described below (`dropIfBackedUp`, the send-buffer ceiling) need the transport hardening in a later kempo-server release; on 3.4.0 they degrade gracefully to "not enforced".

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

That is the whole loop for server-to-browser updates. The rest of this page is what to know before relying on it, and how to go the other way: [handling messages from clients](#handling-messages-from-clients).

## Channels

A channel is named `<owner>:<name>`. The owner is an extension's package name (`kempo` for core), so two extensions cannot collide and a channel always says who is responsible for it.

**Channels are closed by default.** A channel must have a permission (or an `authorize` function) before anyone can subscribe to it. A declared channel with no `permission` is treated as if it did not exist.

**Every user has a private channel**, `user:<their user id>`. Only that user can subscribe to it, and it needs no declaration. Use it to send something to one person:

```javascript
await realtime.publish({ channel: `user:${userId}`, data: { notice: 'Your export is ready' } });
```

Disabling an extension closes its channels, since they are read from the stored extension config.

### Channel options

| Option | Default | |
|---|---|---|
| `permission` | none | The permission a user needs to subscribe. Required unless the channel has an `authorize` function |
| `persist` | `false` | Store messages so a reconnecting client can catch up |
| `retention` | `"24h"` | How long persisted messages are kept |
| `scope` | `"cluster"` | `"cluster"` delivers through Postgres to subscribers on every process. `"process"` delivers in memory, only to subscribers on the process that publishes; see [Fast channels](#fast-channels) |
| `onMessage` | none | A path inside your package, such as `"./handlers/move.js"`, that receives what clients send to the channel; see [Handling messages from clients](#handling-messages-from-clients) |
| `dropIfBackedUp` | `false` | Skip a delivery to a client that is already behind, for data where only the newest value matters |

Anything about a declaration that cannot be honoured, such as `persist` together with `scope: "process"`, or an `onMessage` path that leaves your package, closes the channel instead of quietly opening it with different behaviour than you asked for.

### Declaring a channel in code

Extensions should use `kempo-config.json`. Application code can register a channel instead:

```javascript
import { realtime } from 'kempo/server/sdk.js';

realtime.registerChannel({
  owner: 'my-app',
  name: 'announcements',
  permission: 'my-app:announcements:read',   // and/or: authorize: async ({ user, channel }) => boolean
  persist: false,
  scope: 'cluster',
  onMessage: async ({ user, channel, data, connectionId }) => { /* ... */ },   // a function here, a path in kempo-config.json
  dropIfBackedUp: false
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

## Handling messages from clients

A browser sends to a channel it is subscribed to, and the channel's `onMessage` handler receives it. Declare the handler next to the channel:

```json
"realtime": {
  "channels": [
    { "name": "arena", "permission": "my-ext:arena:play", "scope": "process", "onMessage": "./handlers/arena.js" }
  ]
}
```

```javascript
// handlers/arena.js
import { realtime } from 'kempo/server/sdk.js';

export default async ({ user, channel, data, connectionId }) => {
  if(typeof data?.x !== 'number') throw { code: 400, msg: 'x must be a number' };
  await realtime.publish({ channel, data: { who: user.id, x: data.x, y: data.y } });
  return { accepted: true };
};
```

The handler gets the signed-in `user`, the `channel`, whatever the client sent as `data`, and the `connectionId` of the sender. What it returns goes back to the sender as an acknowledgement (`null` if it returns nothing). It refuses on purpose by throwing `{ code, msg }`, and the sender receives that code and message. Any other error is a bug: it is logged on the server and the sender receives a generic `500`, never the error's text.

In the browser:

```javascript
const reply = await realtime.send('my-ext:arena', { x: 4, y: 9 });   // resolves with the handler's return value
```

`send(channel, data, { timeout })` returns a promise that resolves with the handler's return value or rejects with `{ code, msg }`. It rejects with `503` if the socket is not open and `504` if no reply arrives within `timeout` (10 seconds by default). It never queues while disconnected and replays later: input that arrives late is usually wrong, so a send either goes out now or fails.

How the server treats messages, so a handler can rely on it:

- **A connection's messages are handled strictly in order**, one at a time. A handler never sees one client's inputs out of order or concurrently.
- **The handler is loaded once and kept in memory.** Handling a message never touches the database or the disk. Subscribing to the channel loads it, so the first message is as fast as the thousandth. If it cannot be loaded, senders get a `500` and the problem is logged.
- **A client must be subscribed** to the channel to send to it (`403` otherwise), and a channel with no handler answers `405`.
- **A client that outpaces its handler is told so.** At most 200 messages per connection wait to be handled (`429` beyond that).
- **A client that sends too fast is refused and then cut off.** Over `KEMPO_REALTIME_MAX_MESSAGES_PER_SECOND` (default 100) each extra message gets a `429`; a connection that stays over the limit for five seconds in a row is closed with `1008`. A burst is fine, a flood is not.

Authorization is the channel's, checked when the client subscribes. To validate every message, do it in the handler: it has the user.

### Sending to one connection

A handler, or any server code, can send to a single connection instead of a whole channel:

```javascript
realtime.sendToConnection({ connectionId, data: { hit: 12 } });
```

The browser receives it through `realtime.onDirect((data) => …)`. Connection ids belong to the process that holds the connection, so this only reaches a connection held by this process (`404` otherwise). To reach one user wherever they are connected, publish to their `user:<id>` channel.

## Fast channels

Every message on a normal channel goes through Postgres: a `NOTIFY` per publish, which is what lets every process deliver it, and what limits the rate. A channel with `"scope": "process"` skips all of that. A publish is delivered in memory, only to subscribers held by the process that publishes, and never touches the database.

Use it for traffic that is too fast for the bus and only matters to the connections in front of you, such as a game's positions. Because it stays on one process it **cannot persist**, and a subscriber on another process does not see it. To make everyone in one "room" land on one process, route them there with your load balancer (a sticky room id in the URL or a cookie).

Pair it with `dropIfBackedUp` when only the latest value matters: a client that is already behind skips the delivery instead of queuing it, so a slow connection falls behind on positions rather than running out of memory.

## Reacting to connections

Extensions observe connections through [hooks](extensions/creating-extensions.md#hooks), declared like any other. Hooks are for **lifecycle**, not for messages: kempo runs hooks one at a time and reads the hook table on every call, which is right for something that happens once per connection and wrong for something that happens 20 times a second. For per-message work use `onMessage`.

| Event | Data | When |
|---|---|---|
| `realtime:connected` | `{ connectionId, userId, path }` | A socket is open and its user is known |
| `realtime:disconnected` | `{ connectionId, userId, path, channels, reason }` | A socket closes; `channels` is what it was subscribed to, `reason` the close code |
| `realtime:before_subscribe` | `{ connectionId, userId, user, channel }` | Before a subscription is granted. Throw `{ code, msg }` to refuse |
| `realtime:subscribed` | `{ connectionId, userId, channel }` | After a subscription is granted |
| `realtime:unsubscribed` | `{ connectionId, userId, channel, reason }` | After a subscription ends, including by disconnecting (`reason: "disconnect"`) |

`realtime:before_subscribe` is a **guard**: it runs after the channel's permission check and can add rules a permission cannot express (a room is full, the game has started). It fails closed. A hook that throws `{ code, msg }` refuses with that code and message; one that throws anything else, or a database that cannot be reached, refuses with `403` and logs the cause. The other events are notifications: an error in one is logged and does not affect the connection.

A hook is how an extension notices a player leaving:

```javascript
// hooks/left.js
export default async ({ userId, channels }) => {
  if(channels.includes('my-ext:arena')) await removePlayer(userId);
};
```

## Acting on connections from server code

All exported from the [Server SDK](extensions/sdk.md#realtime):

| Function | |
|---|---|
| `realtime.publish({ channel, data })` | To everyone subscribed, on every process (or this one, for a `process` channel) |
| `realtime.sendToConnection({ connectionId, data })` | To one connection held by this process |
| `realtime.closeConnection({ connectionId, code, reason })` | Close one connection held by this process |
| `realtime.listSubscribers({ channel })` | Who this process holds on a channel |
| `realtime.listConnections()` | Every connection this process holds |

To end a user's access everywhere, delete their sessions: every process closes the sockets behind a dead session within 30 seconds.

## Limits and backpressure

A connection is a resource, and one client must not be able to exhaust the server.

| Limit | Default | Set with |
|---|---|---|
| Connections per user | 10 | `KEMPO_REALTIME_MAX_CONNECTIONS_PER_USER` |
| Messages per second, per connection | 100 | `KEMPO_REALTIME_MAX_MESSAGES_PER_SECOND` |
| Messages waiting to be handled, per connection | 200 | not configurable |
| Total connections, and connections per IP | unlimited | kempo-server `websocket.maxConnections`, `websocket.maxConnectionsPerIp` |
| Outgoing buffer, per connection | 4 MiB | kempo-server `websocket.maxBufferedAmount` |

A user over their connection limit is refused with close code `4429`; the browser client stops (status `refused`) instead of retrying, since it would only be refused again.

**Backpressure.** Frames to a client whose network cannot keep up queue in the server's memory. A delivery to a channel with `dropIfBackedUp` is skipped once that queue passes a high-water mark, and a connection whose queue passes the ceiling is closed with `1013` ("try again later") rather than growing without bound. When it reconnects, a persisted channel replays what it missed.

**Behind a proxy**, set kempo-server's `websocket.trustProxy` so the per-IP limit counts the visitor and not the proxy.

## What it can carry

Measured with `tests/realtime-capacity.node-test.js`, which starts a real kempo-server and drives it with 20 clients each sending 20 messages a second to a shared `scope: "process"` channel whose handler republishes to the channel, so every client receives every message. That is 400 messages a second in and 8,000 deliveries a second out, for 20 seconds, once with a raw no-delay TCP client and once with Node's built-in `WebSocket`.

| Client | Delivered | p50 | p95 | p99 | Slowest |
|---|---|---|---|---|---|
| Raw TCP, no-delay | 100% | 1.8 ms | 4 to 5 ms | 5.5 to 6.5 ms | 6 to 15 ms |
| Built-in `WebSocket` | 100% | 2 ms | 5 to 8 ms | 7 to 10 ms | 9 to 16 ms |

Latency is send to receive, measured in one process, so it has no clock skew and includes the server's handler. Read it with these caveats:

- **Loopback.** The network contributes nothing. A real player adds their round-trip time to every figure.
- **One machine** ran the server and the clients, so both competed for the CPU. A dedicated server would do at least as well.
- **Windows** timers tick about every 15 ms, which limits how evenly a client can pace its sends. The test compensates so the real rate is the stated rate.
- **The test asserts generous bounds** (p50 under 250 ms, p95 under 500 ms, p99 under 150 ms, nothing lost) so a busy machine does not fail the run; the figures above are the result, the bounds are the alarm.

For scale: 20 players at 20 updates a second is about as demanding as a small real-time game gets, and it used a small fraction of one process. A `scope: "cluster"` channel is bounded by Postgres `NOTIFY` instead, which is why fast traffic belongs on a process channel.

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
| `refused` | The user is at their connection limit; the client has stopped and will not retry |
| `closed` | `realtime.close()` was called |

`realtime.send(channel, data, { timeout })` sends to a channel's handler and resolves with its reply; `realtime.onDirect(fn)` receives what the server sends to this connection alone. `realtime.onStatus(fn)` reports changes, `realtime.userId` and `realtime.onReady(fn)` give the signed-in user's id, and `realtime.close()` stops it for good.

A server restart reconnects almost immediately. Any other failure retries with growing, jittered delays, and first asks whether the session is still valid so that signing out does not turn into an endless retry loop.

## Wire protocol

For a client that is not the bundled one. Connect to `/kempo/api/realtime` with the session cookie; frames are JSON text.

| Direction | Frame |
|---|---|
| Client to server | `{ "type": "subscribe", "channel": "my-ext:orders", "since": 42 }` (`since` optional) |
| Client to server | `{ "type": "unsubscribe", "channel": "my-ext:orders" }` |
| Client to server | `{ "type": "send", "channel": "my-ext:arena", "data": …, "ref": 7 }` (`ref` optional; give one to get a reply) |
| Server to client | `{ "type": "ready", "userId": "…" }` on connect |
| Server to client | `{ "type": "subscribed", "channel": "…" }` |
| Server to client | `{ "type": "unsubscribed", "channel": "…" }` |
| Server to client | `{ "type": "message", "channel": "…", "id": 43, "data": … }` |
| Server to client | `{ "type": "direct", "data": … }`, sent to this connection alone |
| Server to client | `{ "type": "ack", "channel": "…", "ref": 7, "data": … }`, the handler's return value |
| Server to client | `{ "type": "gap", "channel": "…" }` |
| Server to client | `{ "type": "error", "channel": "…", "ref": 7, "code": 403, "msg": "…" }` (`ref` when it answers a `send`) |

A malformed frame gets an `error` frame and the connection stays open. Close codes: `4401` the session ended, `4429` the user is at their connection limit, `1008` the connection sent far too fast, `1013` its outgoing buffer overflowed. The first two mean the client should not reconnect.

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
| `KEMPO_REALTIME_MAX_CONNECTIONS_PER_USER` | `10` | Sockets one user may hold open at once |
| `KEMPO_REALTIME_MAX_MESSAGES_PER_SECOND` | `100` | Messages one connection may send per second before they are refused |

Socket options such as the maximum message size, the origin allow-list and the heartbeat belong to kempo-server; see its `websocket` configuration.

## Upgrading

1. Update to a kempo that includes realtime, with `kempo-server` 3.4.0 or later.
2. **Create the tables.** Realtime adds `realtimeMessage` and `realtimeChannel`. Apply them the way you apply any kempo schema change (`drizzle-kit push`, or generate and migrate).
3. **Seed the permission.** Run `node node_modules/kempo/scripts/init-db.js` to create `system:realtime:read` and grant it to Administrators. It is safe to run again. Administrators can already use the admin page before this, since that group passes every permission check; it matters for granting the permission to other groups.

## Deployment notes

- **Connection poolers.** Realtime holds one dedicated connection that stays in `LISTEN`. That does not work through a pooler in transaction mode, such as PgBouncer. Point kempo at Postgres directly, or use session pooling.
- **Several processes** need nothing extra. They share one database and therefore one bus.

## Not included

- **Presence** ("who is online") is not built in. `listSubscribers`, `listConnections` and the connection hooks are what an extension builds it from.
- **Clients cannot publish directly.** They `send`, and the channel's handler decides what, if anything, to publish. Nothing a client sends reaches other clients unless an extension's code says so.
- **Cross-process connection control.** `sendToConnection`, `closeConnection` and `listSubscribers` only see this process's connections. Fan-out to other processes goes through `publish`.
- **Game logic, chat, collaboration.** Kempo provides the transport and the primitives; a kempo (CMS) extension provides the behaviour.
