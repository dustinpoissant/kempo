# Realtime

## Description
A WebSocket layer organised into named channels, and the set of primitives that let a kempo (CMS) extension build interactive features on it without touching a socket. Extensions declare channels and publish to them; signed-in browsers subscribe and receive messages, on whichever kempo process they are connected to; browsers send to a channel and the extension's handler answers; hooks report connection lifecycle and SDK functions act on connections. Channels can persist messages so a client that reconnects replays what it missed. Nothing in it is specific to any feature: chat, collaborative editing and games are all extensions. User-facing documentation is in [docs/realtime.md](../../docs/realtime.md); this document records how it works and why.

## Dependencies
- [Auth](auth.md) — a socket authenticates with the session cookie, and sessions are re-checked while it is open
- [Server Utils](server-utils.md) — the logic lives in `server/utils/realtime/` and follows the HTTP-agnostic, error-tuple rules
- [Server SDK](server-sdk.md) — exposed to extensions as the `realtime` namespace
- [Database](db.md) — two tables, and Postgres `LISTEN`/`NOTIFY` as the cross-process bus
- [API](api.md) — the socket is `src/kempo/api/realtime/WS.js`, a kempo-server WebSocket route
- kempo-server 3.4.0 or later, which provides the WebSocket transport (`WS.js` routes, framing, origin check, heartbeat)

## Context
kempo-server owns the transport and deliberately stops there: it can hold a socket open and move frames, and it knows nothing about users, channels or the database. This layer turns a raw socket into something an extension can use without touching sockets. The first intended consumer was kempo-payments live status, whose admin pages otherwise only update on a manual refresh. The surface was then widened so it is enough for interactive extensions too, using a fast 2D multiplayer game (10 to 20 players, sub-second updates) as a stress test of capacity, not as a feature: the game is an example of what an extension could be, and kempo carries no game concepts.

### Decisions
- **Lives in core, not an extension.** Other extensions depend on it the way they depend on hooks and permissions; making it an optional extension would make every consumer a soft dependency.
- **Postgres `LISTEN`/`NOTIFY` is the bus, and persisted messages use an outbox.** kempo already requires Postgres, so this adds no service. A persisted publish inserts a row and notifies with only its id, in one transaction; other processes read the row. `NOTIFY` alone keeps nothing, so it could not support replay, and its payload is about 8 KB; the outbox removes both limits for persisted channels. Redis was rejected as a new mandatory dependency.
- **One delivery path per scope.** A `cluster` channel (the default) sends every message, including to subscribers in the publishing process, through `NOTIFY`, so behaviour is identical regardless of which process publishes. A `process` channel is a deliberate, declared exception: it delivers in memory to this process's subscribers and never touches the database, because the bus cannot carry fast traffic. It cannot persist, since nothing is stored, and that combination is refused at registration.
- **Channels are closed by default.** A channel needs a permission (or an `authorize` function) before anyone can subscribe. The only implicit channel is `user:<id>`, subscribable only by that user. A declared channel with no permission is treated as undeclared.
- **Names are `<owner>:<name>`, with the owner enforced structurally.** Two extensions cannot collide because the owner is part of the name. `user` is reserved.
- **Extensions declare channels in `kempo-config.json`, resolved from the `extension` table.** That snapshot is in the database, so every process can read it with no file access. `registerChannel` in code exists for application code, but a registration made in a lazily loaded route may not exist yet when the first subscriber connects, so it is only safe for modules loaded at startup. A declaration has no load-order dependency, which is why extensions should use it. Code registrations win over declarations of the same name.
- **Persistence is opt-in per channel**, so ephemeral traffic never writes a row. Default retention is 24 hours.
- **Clients send to a handler, never publish.** A client's `send` goes to the channel's `onMessage` handler, which decides what to publish. Nothing a client sends reaches other clients unless the extension's code says so, so an extension always has the chance to validate.
- **Hooks for lifecycle, declared handlers for messages.** kempo hooks read the hook table on every call and run one at a time, which is fine once per connection and wrong at 20 messages a second per client. So connection events (`realtime:connected`, `disconnected`, `subscribed`, `unsubscribed`, and the guard `before_subscribe`) are hooks, while `onMessage` is a path declared on the channel and loaded once into memory. A per-message database read was the specific thing this avoids.
- **`before_subscribe` fails closed.** It is a guard that can add rules a permission cannot express. A hook that throws `{ code, msg }` refuses with that; anything else, including an unreachable database, refuses with a generic `403` and logs the cause.
- **Handler paths are confined to the owner's package.** `onMessage` must start `./` and resolve inside `node_modules/<owner>`; a manifest cannot point the server at arbitrary code. A declaration that cannot be honoured closes the channel.
- **A connection's messages are handled in order, one at a time, and bounded.** Out-of-order input is wrong for almost anything a handler does. At most 200 wait per connection (`429`); over 100 messages a second each extra is refused, and five consecutive seconds over the rate closes the connection with `1008`, since that is abuse and not a burst.
- **A handler is loaded on subscribe, not on first message.** The first capacity runs showed a ~200 ms p99 tail: the first message of each run paid for a dynamic `import`. It was first suspected to be Nagle and delayed-ACK interaction, and disproved (the tail followed whichever phase ran first, not the client or its socket options). Warming the handler when a subscription is granted removed it, and a test fails if that call is removed.
- **Connection ids are process-local.** `sendToConnection`, `closeConnection` and `listSubscribers` only see this process, because sockets belong to the process that accepted them. Reaching a user everywhere is a `user:<id>` publish; ending access everywhere is deleting the session, which every process notices.
- **Limits are per user, per connection and per IP, with backpressure.** Per-user connection cap (`4429`, and the client stops), per-connection message rate and queue, and in kempo-server a send-buffer ceiling (`1013`) plus optional total and per-IP connection limits behind an explicit `trustProxy`. `dropIfBackedUp` lets a channel where only the latest value matters skip a slow client instead of queueing.
- **Authorization runs on subscribe only.** A permission changed afterwards does not affect an existing subscription. A session ending does, and is enforced separately (below).
- **State is held on `Symbol.for` globals**, not module scope, for the channel registry and the hub. kempo can be resolved twice in one process (a symlinked checkout, a hoisted copy beside a nested one), and a registration or a socket held by one copy must be visible to the other.
- **The admin view is per process.** Sockets are held by the process that accepted them; aggregating across processes would need request/response over the bus, which was out of scope.

## Implementation

### Layout
- `src/kempo/api/realtime/WS.js` — the HTTP layer only: session cookie to user, frames to the hub and back
- `src/kempo/api/realtime/connections/GET.js` — admin listing, gated by `system:realtime:read`
- `server/utils/realtime/Hub.js` — per-process state: subscribers, subscriptions, the listening connection, replay, session checks
- `server/utils/realtime/getHub.js` — the per-process singleton
- `server/utils/realtime/channels.js` — registration, resolution, authorization
- `server/utils/realtime/publish.js`, `sendToConnection.js`, `closeConnection.js`, `listSubscribers.js`, `pruneMessages.js`, `listConnections.js`, `duration.js`, `constants.js`
- `server/utils/realtime/index.js` — the public surface, exported from `server/sdk.js` as `realtime`
- `src/kempo/realtime.js` — the browser client, served at `/kempo/realtime.js`
- `src/admin/realtime/index.page.html` — the admin page

Do not name two files in `server/utils/realtime/` so that they differ only in letter case. The project is developed on case-insensitive filesystems and this once silently overwrote the hub class with its own accessor; `tests/package-invariants.node-test.js` checks import case.

### Tables
- `realtimeMessage` — `id` (bigserial, the replay cursor), `channel`, `data` (jsonb), `createdAt`; indexed on `(channel, id)`
- `realtimeChannel` — `channel`, `prunedThrough`: the highest id pruned from that channel

Ids are shared across channels, so a gap cannot be inferred from id arithmetic. `prunedThrough` is the watermark: a client whose `since` is below it has provably missed messages and is sent a `gap` frame.

### Publishing and ordering
A persisted publish takes `pg_advisory_xact_lock(hashtext('kempo:realtime:' || channel))`, inserts, and calls `pg_notify` in the same transaction. Ids are handed out at insert but become visible at commit; without the lock two publishes could commit out of id order, and a client replaying from the earlier id would skip the later-committing row permanently. `NOTIFY` is delivered on commit, so a listener is never told about a row it cannot yet read.

A non-persisted message travels inline in the notification, capped at 7,900 bytes (Postgres allows under 8,000). Over the cap is a `413`, not a silent failure.

### Delivery
Each process holds one **dedicated** connection in `LISTEN` (not one borrowed from the query pool, since `LISTEN` holds its session). Notifications are handled **strictly one at a time** through a promise queue: a persisted message needs a row read, and two reads in flight can finish out of order, which would deliver a later id first and make the earlier one look like a duplicate and be dropped.

The connection is started on the first subscribe, not at boot, so a process with no sockets holds no extra connection. When it reconnects after dropping, persisted subscriptions are caught up from the table; a message on a non-persisted channel published during the outage is lost, which is the at-most-once guarantee that kind of channel makes.

### Replay and the boundary
Subscribing with `since` registers the subscription **first** in a buffering state, then reads the backlog in batches, then drains the buffer and goes live. The drain and the switch to live have no `await` between them, so nothing can be delivered in between. Duplicates are removed by comparing each id to the last delivered one. Registering before reading is what guarantees no message falls into the gap between "read up to here" and "live from now".

### Sessions
A socket authenticates once at connect. Every `KEMPO_REALTIME_SESSION_CHECK_MS` (default 30 s) the sessions behind open sockets are re-checked, and a socket whose session no longer exists is closed with code **4401**, which the browser client treats as final. Only a definite "session not found" closes a socket; a database error does not, so a blip cannot disconnect everyone. The timer runs only while there are subscribers and is unref'd.

### The route registers subscribers on `open`
The `WS.js` route runs before the handshake completes so it can refuse with a real HTTP status. Registering the subscriber there would leak it if the client vanished before the handshake finished, since no close event ever fires. It registers on the socket's `open` event instead.

### Browser client
A browser does not reconnect a closed WebSocket. The client reconnects with jittered exponential backoff, resubscribes each channel with the last id it saw, treats close code 1001 (server restarting) as an immediate reconnect, and stops for good on 4401. A refused connection is ambiguous to a browser (a bare failure with no status), so before retrying a handshake that never opened it asks `/kempo/api/auth/session`, and stops only on a definite "no user"; a network error keeps retrying.

Browsers fire `error` then `close` for a failed connection, but Node's WebSocket fires only `error`. The client therefore ends an attempt on either, once, so it also retries under Node.

### Permissions
`system:realtime:read` gates the admin listing. It is seeded in `scripts/init-db.js` and granted to `system:Administrators`. Administrators already pass every permission check, so the admin page works before an existing install re-runs `init-db.js`.

## Notes
- **`LISTEN` does not work through a transaction-mode pooler** such as PgBouncer. Documented for deployments.
- **Slow clients.** kempo-server exposes a socket's `bufferedAmount` and closes a connection whose queue passes `maxBufferedAmount`; a channel can also opt into `dropIfBackedUp`. Those need the transport hardening released after kempo-server 3.4.0. On 3.4.0 they are not enforced, and nothing else changes.
- **Measured capacity** (`tests/realtime-capacity.node-test.js`): 20 clients at 20 messages a second each into one `process` channel that republishes, so 400 messages in and 8,000 deliveries out per second, on loopback. Nothing was lost; p50 is about 2 ms, p95 under 8 ms, p99 under 10 ms, slowest under 16 ms, for both a raw no-delay client and Node's built-in `WebSocket`. Loopback removes the network and the machine ran both ends, so real players add their round trip. The test asserts loose bounds so a busy machine does not fail it.
- **Test pitfalls learned here.** A test that never calls `pass()` reports a failure, and the framework keeps the sticky first failure (kempo-testing-framework 1.5.0). Mutation-check a test to prove it can fail, and when filtering a run by name make sure the filter matches, or nothing runs and a mutation looks caught. `realtime-http` must run as a whole file, because its setup is a test, and `dist/` must be rebuilt first because it serves the built client and route.
- **Tests.** `tests/realtime-hub.node-test.js` uses two `Hub` instances as two processes, each with its own listening connection; `tests/realtime-http.node-test.js` runs a real kempo-server process with the real middleware and the built `dist`, so a publish from the test process reaching it exercises the true cross-process path. The database suites report `(SKIPPED)` and count as passing when no database is reachable, so check for that name before trusting a green run.
- **Out of scope**: presence itself (an extension builds it from `listSubscribers` and the hooks), client-to-server publishing (a handler publishes on the client's behalf), cross-process connection control, a cross-process admin view, message replay for non-persisted channels, room routing across processes (a load balancer's job for `process` channels).
