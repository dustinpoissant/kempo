import crypto from 'crypto';
import postgres from 'postgres';
import { and, asc, eq, gt } from 'drizzle-orm';
import db from '../../db/index.js';
import { realtimeMessage, realtimeChannel } from '../../db/schema.js';
import getSession from '../auth/getSession.js';
import triggerHook from '../hooks/triggerHook.js';
import pruneMessages from './pruneMessages.js';
import { resolveChannel, authorizeSubscription, loadMessageHandler } from './channels.js';
import { BUS_CHANNEL, SESSION_CLOSE_CODE, RATE_LIMIT_CLOSE_CODE } from './constants.js';

const BACKLOG_BATCH = 500;
const DEFAULT_SESSION_CHECK_MS = 30000;
const DEFAULT_PRUNE_MS = 10 * 60 * 1000;
const DEFAULT_MAX_CONNECTIONS_PER_USER = 10;
const DEFAULT_MAX_MESSAGES_PER_SECOND = 100;
const DEFAULT_MAX_PENDING_MESSAGES = 200;
// Consecutive one-second windows over the message rate before a connection is judged abusive rather than bursty
const RATE_STRIKES_BEFORE_CLOSE = 5;

/*
  The realtime state of one process: who is connected, what they are subscribed to, and the connection
  that listens for messages published anywhere.

  Delivery on a normal (cluster) channel has one path. A publish becomes a Postgres NOTIFY, every process
  holding subscribers is listening, and each delivers to its own. A process therefore only ever talks to
  its own sockets, which is what lets several kempo processes share one database and behave as one system.

  A channel with scope "process" skips all of that: it delivers in memory to the subscribers held by the
  process that publishes, and never touches the database, so it can carry traffic the bus cannot.
*/
export default class Hub {
  #databaseUrl;
  #sessionCheckMs;
  #pruneMs;
  #maxConnectionsPerUser;
  #maxMessagesPerSecond;
  #maxPendingMessages;
  #rateStrikes;
  #log;
  #subscribers = new Map();
  #channels = new Map();
  #listener = null;
  #starting = null;
  #queue = Promise.resolve();
  #listenCount = 0;
  #sessionTimer = null;
  #pruneTimer = null;
  #checkingSessions = false;

  constructor({
    databaseUrl = process.env.DATABASE_URL,
    sessionCheckMs = Number(process.env.KEMPO_REALTIME_SESSION_CHECK_MS) || DEFAULT_SESSION_CHECK_MS,
    pruneMs = Number(process.env.KEMPO_REALTIME_PRUNE_MS) || DEFAULT_PRUNE_MS,
    maxConnectionsPerUser = Number(process.env.KEMPO_REALTIME_MAX_CONNECTIONS_PER_USER) || DEFAULT_MAX_CONNECTIONS_PER_USER,
    maxMessagesPerSecond = Number(process.env.KEMPO_REALTIME_MAX_MESSAGES_PER_SECOND) || DEFAULT_MAX_MESSAGES_PER_SECOND,
    maxPendingMessages = DEFAULT_MAX_PENDING_MESSAGES,
    rateStrikes = RATE_STRIKES_BEFORE_CLOSE,
    log = console
  } = {}){
    this.#databaseUrl = databaseUrl;
    this.#sessionCheckMs = sessionCheckMs;
    this.#pruneMs = pruneMs;
    this.#maxConnectionsPerUser = maxConnectionsPerUser;
    this.#maxMessagesPerSecond = maxMessagesPerSecond;
    this.#maxPendingMessages = maxPendingMessages;
    this.#rateStrikes = rateStrikes;
    this.#log = log;
  }

  /*
    Subscribers
  */

  addSubscriber = ({ token, user, path, deliver, close } = {}) => {
    if(!token || !user?.id){
      return [{ code: 401, msg: 'Authentication required' }, null];
    }
    if(typeof deliver !== 'function' || typeof close !== 'function'){
      return [{ code: 400, msg: 'deliver and close are required' }, null];
    }

    let held = 0;
    for(const existing of this.#subscribers.values()){
      if(existing.user.id === user.id) held++;
    }
    if(held >= this.#maxConnectionsPerUser){
      return [{ code: 429, msg: 'Too many connections for this user' }, null];
    }

    const id = crypto.randomUUID();
    const now = new Date();
    this.#subscribers.set(id, {
      id,
      token,
      user: { id: user.id, name: user.name, email: user.email },
      path,
      connectedAt: now,
      lastActivity: now,
      deliver,
      close,
      subscriptions: new Map(),
      queue: Promise.resolve(),
      pending: 0,
      rate: { start: Date.now(), count: 0, overWindows: 0 }
    });

    this.#startSessionTimer();
    this.#fire('realtime:connected', { connectionId: id, userId: user.id, path });
    return [null, { id }];
  };

  removeSubscriber = ({ id, reason } = {}) => {
    const subscriber = this.#subscribers.get(id);
    if(!subscriber) return [null, { removed: false }];

    const channels = [...subscriber.subscriptions.keys()];
    for(const channel of channels){
      this.#forget(id, channel);
    }
    this.#subscribers.delete(id);
    if(!this.#subscribers.size) this.#stopSessionTimer();

    for(const channel of channels){
      this.#fire('realtime:unsubscribed', { connectionId: id, userId: subscriber.user.id, channel, reason: 'disconnect' });
    }
    this.#fire('realtime:disconnected', { connectionId: id, userId: subscriber.user.id, path: subscriber.path, channels, reason });
    return [null, { removed: true }];
  };

  touch = ({ id } = {}) => {
    const subscriber = this.#subscribers.get(id);
    if(subscriber) subscriber.lastActivity = new Date();
  };

  /*
    Subscriptions
  */

  subscribe = async ({ id, channel, since } = {}) => {
    const subscriber = this.#subscribers.get(id);
    if(!subscriber){
      return [{ code: 404, msg: 'Unknown subscriber' }, null];
    }
    if(typeof channel !== 'string' || !channel){
      return [{ code: 400, msg: 'Channel is required' }, null];
    }
    if(since !== undefined && since !== null && (!Number.isInteger(since) || since < 0)){
      return [{ code: 400, msg: 'since must be a message id' }, null];
    }
    if(subscriber.subscriptions.has(channel)){
      return [null, { channel, subscribed: true }];
    }

    const config = await resolveChannel(channel);
    if(!config){
      return [{ code: 404, msg: `Channel "${channel}" does not exist` }, null];
    }

    const [authError, allowed] = await authorizeSubscription({ config, user: subscriber.user });
    if(authError) return [authError, null];
    if(!allowed){
      return [{ code: 403, msg: 'Not allowed to subscribe to this channel' }, null];
    }

    const refusal = await this.#guard(subscriber, channel);
    if(refusal) return [refusal, null];

    /*
      Load the channel's message handler now, not on the first message. Importing a handler pulls in
      everything it uses, which took around 200ms in practice, and every connection's first messages queue
      behind it: a visible hitch for whoever sends first after a restart. A failure here is deliberately
      ignored, since sending will try again and report it to the client that hit it.
    */
    loadMessageHandler(config).catch(() => {});

    // Only a channel that crosses processes needs the listening connection
    if(config.scope !== 'process'){
      try {
        await this.#ensureBus();
      } catch(error) {
        this.#log.error(`[realtime] could not start the listening connection: ${error.message}`);
        return [{ code: 503, msg: 'Realtime is unavailable' }, null];
      }
    }

    // The connection may have closed, or the same channel been requested again, while the awaits above ran
    if(!this.#subscribers.has(id)) return [{ code: 410, msg: 'Subscriber is gone' }, null];
    if(subscriber.subscriptions.has(channel)) return [null, { channel, subscribed: true }];

    const replay = config.persist && since !== undefined && since !== null;
    const subscription = {
      buffering: replay,
      buffer: [],
      lastId: replay ? since : null,
      dropIfBackedUp: config.dropIfBackedUp
    };

    /*
      Registered before anything is read. Messages that arrive while the backlog is being loaded are held
      in the buffer rather than delivered, so none can fall between "read up to here" and "live from now".
    */
    subscriber.subscriptions.set(channel, subscription);
    if(!this.#channels.has(channel)) this.#channels.set(channel, new Set());
    this.#channels.get(channel).add(id);

    this.#deliverFrame(subscriber, { type: 'subscribed', channel });

    if(replay){
      try {
        await this.#backlog(subscriber, subscription, channel, since);
      } catch(error) {
        this.#log.error(`[realtime] replay failed for ${channel}: ${error.message}`);
        this.unsubscribe({ id, channel });
        return [{ code: 500, msg: 'Failed to replay missed messages' }, null];
      }
    }

    this.#fire('realtime:subscribed', { connectionId: id, userId: subscriber.user.id, channel });
    return [null, { channel, subscribed: true }];
  };

  unsubscribe = ({ id, channel, reason = 'client' } = {}) => {
    const subscriber = this.#subscribers.get(id);
    if(!subscriber?.subscriptions.has(channel)) return [null, { unsubscribed: false }];

    subscriber.subscriptions.delete(channel);
    this.#forget(id, channel);
    this.#fire('realtime:unsubscribed', { connectionId: id, userId: subscriber.user.id, channel, reason });
    return [null, { unsubscribed: true }];
  };

  /*
    Messages from clients

    A client sends to a channel it is subscribed to, and the channel's own handler receives it. The handler
    is loaded once and kept in memory: this is the hot path, so it must never wait on the database.

    A connection's messages are handled strictly in order, since input arriving out of order is wrong for
    almost anything a handler does, and the number waiting is bounded so a client that outpaces its handler
    is told so instead of building a queue. Sending faster than `maxMessagesPerSecond` is refused, and a
    connection that does so window after window is closed, since that is abuse rather than a burst.
  */

  handleMessage = ({ id, channel, data } = {}) => {
    const subscriber = this.#subscribers.get(id);
    if(!subscriber){
      return Promise.resolve([{ code: 404, msg: 'Unknown subscriber' }, null]);
    }

    const limited = this.#rateLimit(subscriber);
    if(limited) return Promise.resolve(limited);

    if(subscriber.pending >= this.#maxPendingMessages){
      return Promise.resolve([{ code: 429, msg: 'Too many messages are waiting to be handled' }, null]);
    }

    subscriber.pending++;
    const result = subscriber.queue.then(() => this.#process(subscriber, channel, data));
    subscriber.queue = result.then(() => { subscriber.pending--; }, () => { subscriber.pending--; });
    return result;
  };

  #rateLimit = (subscriber) => {
    const rate = subscriber.rate;
    const now = Date.now();

    if(now - rate.start >= 1000){
      rate.overWindows = rate.count > this.#maxMessagesPerSecond ? rate.overWindows + 1 : 0;
      rate.start = now;
      rate.count = 0;
    }

    rate.count++;
    if(rate.count <= this.#maxMessagesPerSecond) return null;

    if(rate.overWindows + 1 >= this.#rateStrikes){
      this.#log.error(`[realtime] closing ${subscriber.id} (user ${subscriber.user.id}): message rate exceeded for ${this.#rateStrikes} windows`);
      this.closeConnection({ connectionId: subscriber.id, code: RATE_LIMIT_CLOSE_CODE, reason: 'Message rate exceeded' });
    }
    return [{ code: 429, msg: 'Message rate exceeded' }, null];
  };

  #process = async (subscriber, channel, data) => {
    if(!subscriber.subscriptions.has(channel)){
      return [{ code: 403, msg: 'Not subscribed to this channel' }, null];
    }

    const config = await resolveChannel(channel);
    if(!config){
      return [{ code: 404, msg: `Channel "${channel}" no longer exists` }, null];
    }

    let handler;
    try {
      handler = await loadMessageHandler(config);
    } catch(error) {
      this.#log.error(`[realtime] the message handler for ${channel} could not be loaded: ${error.message}`);
      return [{ code: 500, msg: 'Message handler unavailable' }, null];
    }
    if(!handler){
      return [{ code: 405, msg: 'This channel does not accept messages' }, null];
    }

    try {
      const result = await handler({ user: subscriber.user, channel, data, connectionId: subscriber.id });
      return [null, result === undefined ? null : result];
    } catch(error) {
      // A handler refuses on purpose by throwing { code, msg }; anything else is a bug and stays private
      if(Number.isInteger(error?.code) && error.code >= 400 && error.code < 600 && typeof error.msg === 'string'){
        return [{ code: error.code, msg: error.msg }, null];
      }
      this.#log.error(`[realtime] the message handler for ${channel} threw: ${error?.message}`);
      return [{ code: 500, msg: 'Message handler failed' }, null];
    }
  };

  /*
    Acting on connections. Connection ids belong to the process that holds the connection, so these only
    reach connections on this process.
  */

  sendToConnection = ({ connectionId, data } = {}) => {
    const subscriber = this.#subscribers.get(connectionId);
    if(!subscriber){
      return [{ code: 404, msg: 'No such connection on this process' }, null];
    }
    return [null, { delivered: this.#deliverFrame(subscriber, { type: 'direct', data }) }];
  };

  closeConnection = ({ connectionId, code = 1000, reason = '' } = {}) => {
    const subscriber = this.#subscribers.get(connectionId);
    if(!subscriber){
      return [{ code: 404, msg: 'No such connection on this process' }, null];
    }

    try {
      subscriber.close(code, reason);
    } catch(error) {
      this.#log.error(`[realtime] could not close ${connectionId}: ${error.message}`);
    }
    this.removeSubscriber({ id: connectionId, reason: code });
    return [null, { closed: true }];
  };

  listSubscribers = ({ channel } = {}) => {
    const ids = this.#channels.get(channel);
    return [null, {
      channel,
      subscribers: [...(ids || [])].map(id => {
        const subscriber = this.#subscribers.get(id);
        return { connectionId: id, userId: subscriber.user.id, userName: subscriber.user.name };
      })
    }];
  };

  /*
    Delivery without the database: to every subscriber of `channel` held by this process. Returns how
    many it reached, which excludes any skipped because they are behind on a dropIfBackedUp channel.
  */
  deliverLocal = ({ channel, data } = {}) => {
    const ids = this.#channels.get(channel);
    if(!ids?.size) return 0;

    let delivered = 0;
    for(const id of [...ids]){
      const subscriber = this.#subscribers.get(id);
      const subscription = subscriber?.subscriptions.get(channel);
      if(!subscription) continue;
      if(this.#send(subscriber, subscription, channel, { data })) delivered++;
    }
    return delivered;
  };

  /*
    Inspection
  */

  listConnections = () => [null, {
    process: process.pid,
    connections: [...this.#subscribers.values()].map(subscriber => ({
      id: subscriber.id,
      userId: subscriber.user.id,
      userName: subscriber.user.name,
      path: subscriber.path,
      connectedAt: subscriber.connectedAt,
      lastActivity: subscriber.lastActivity,
      channels: [...subscriber.subscriptions.keys()]
    })),
    channels: [...this.#channels].map(([channel, ids]) => ({ channel, subscribers: ids.size }))
  }];

  /*
    Shutdown. The listening connection is released so a process (or a test) can exit cleanly.
  */
  close = async () => {
    this.#stopSessionTimer();
    if(this.#pruneTimer) clearInterval(this.#pruneTimer);
    this.#pruneTimer = null;

    const listener = this.#listener;
    this.#listener = null;
    this.#starting = null;
    this.#subscribers.clear();
    this.#channels.clear();

    await this.#queue.catch(() => {});
    if(listener) await listener.end({ timeout: 1 }).catch(() => {});
  };

  /*
    Hooks

    Lifecycle events go through kempo's hook system so an extension can react to them. That system reads
    the database on every trigger, which is fine for events that happen once per connection and would be
    wrong for anything per message, which is why messages use a handler and not a hook.

    They are notifications: fired without waiting, so a slow or failing handler cannot hold up a
    connection, and no handler can stop what already happened. The one exception is before_subscribe.
  */

  #fire = (event, payload) => {
    Promise.resolve(triggerHook(event, payload)).catch(error => {
      this.#log.error(`[realtime] hook ${event} failed: ${error.message}`);
    });
  };

  /*
    A guard: an extension can refuse a subscription with custom logic beyond a permission, by throwing
    { code, msg } (the same convention as middleware:before_page). It fails closed: a hook that errors,
    or the database being unreachable, refuses the subscription instead of quietly allowing it.
  */
  #guard = async (subscriber, channel) => {
    try {
      await triggerHook('realtime:before_subscribe', {
        connectionId: subscriber.id,
        userId: subscriber.user.id,
        user: subscriber.user,
        channel
      }, { bail: true });
      return null;
    } catch(error) {
      if(Number.isInteger(error?.code) && error.code >= 400 && error.code < 600 && typeof error.msg === 'string'){
        return { code: error.code, msg: error.msg };
      }
      this.#log.error(`[realtime] realtime:before_subscribe failed for ${channel}: ${error?.message}`);
      return { code: 403, msg: 'Subscription refused' };
    }
  };

  /*
    The listening connection
  */

  #ensureBus = () => {
    if(this.#starting) return this.#starting;

    this.#starting = (async () => {
      // A dedicated connection: LISTEN holds its session, so it cannot be borrowed from the query pool
      const listener = postgres(this.#databaseUrl, { max: 1, onnotice: () => {} });

      try {
        await listener.listen(BUS_CHANNEL, payload => this.#enqueue(() => this.#notified(payload)), () => this.#listening());
      } catch(error) {
        await listener.end({ timeout: 1 }).catch(() => {});
        this.#starting = null;
        throw error;
      }

      this.#listener = listener;
      this.#pruneTimer = setInterval(() => {
        pruneMessages().catch(error => this.#log.error(`[realtime] prune failed: ${error.message}`));
      }, this.#pruneMs);
      this.#pruneTimer.unref?.();
    })();

    return this.#starting;
  };

  // Called each time LISTEN is established, so also after the connection drops and comes back
  #listening = () => {
    this.#listenCount++;
    if(this.#listenCount > 1){
      this.#enqueue(() => this.#catchUp());
    }
  };

  /*
    Notifications are handled strictly one at a time. A persisted message needs a database read, and two
    reads in flight can finish out of order; delivering the later id first would then make the earlier one
    look like a duplicate and drop it.
  */
  #enqueue = (task) => {
    this.#queue = this.#queue.then(task).catch(error => {
      this.#log.error(`[realtime] failed to handle a notification: ${error.message}`);
    });
  };

  #notified = async (payload) => {
    let message;
    try {
      message = JSON.parse(payload);
    } catch(error) {
      return;
    }

    const { c: channel, i: id, d: data } = message;
    const subscriberIds = this.#channels.get(channel);
    if(!subscriberIds?.size) return;

    let value = data;
    if(id !== undefined){
      const [row] = await db.select({ data: realtimeMessage.data }).from(realtimeMessage).where(eq(realtimeMessage.id, id)).limit(1);
      // Already pruned between the publish and now
      if(!row) return;
      value = row.data;
    }

    for(const subscriberId of [...subscriberIds]){
      const subscriber = this.#subscribers.get(subscriberId);
      const subscription = subscriber?.subscriptions.get(channel);
      if(!subscription) continue;

      if(subscription.buffering){
        subscription.buffer.push({ id, data: value });
        continue;
      }
      this.#send(subscriber, subscription, channel, { id, data: value });
    }
  };

  /*
    Anything published while the connection was down was never delivered. Persisted channels can be made
    whole again from the table; a message on a channel that does not persist is simply lost, which is the
    at-most-once guarantee such a channel makes.
  */
  #catchUp = async () => {
    for(const [channel, ids] of this.#channels){
      for(const id of [...ids]){
        const subscriber = this.#subscribers.get(id);
        const subscription = subscriber?.subscriptions.get(channel);
        if(!subscription || subscription.buffering || subscription.lastId === null) continue;

        const rows = await db
          .select()
          .from(realtimeMessage)
          .where(and(eq(realtimeMessage.channel, channel), gt(realtimeMessage.id, subscription.lastId)))
          .orderBy(asc(realtimeMessage.id));
        for(const row of rows){
          this.#send(subscriber, subscription, channel, { id: row.id, data: row.data });
        }
      }
    }
  };

  /*
    Replay
  */

  #backlog = async (subscriber, subscription, channel, since) => {
    const [state] = await db
      .select({ prunedThrough: realtimeChannel.prunedThrough })
      .from(realtimeChannel)
      .where(eq(realtimeChannel.channel, channel))
      .limit(1);

    let cursor = since;
    const prunedThrough = state?.prunedThrough ?? 0;
    if(since < prunedThrough){
      this.#deliverFrame(subscriber, { type: 'gap', channel });
      cursor = prunedThrough;
    }

    for(;;){
      const rows = await db
        .select()
        .from(realtimeMessage)
        .where(and(eq(realtimeMessage.channel, channel), gt(realtimeMessage.id, cursor)))
        .orderBy(asc(realtimeMessage.id))
        .limit(BACKLOG_BATCH);

      for(const row of rows){
        this.#send(subscriber, subscription, channel, { id: row.id, data: row.data });
        cursor = row.id;
      }
      if(rows.length < BACKLOG_BATCH) break;
    }

    /*
      No await from here to the end, so nothing can be delivered between draining the buffer and going
      live. Buffered messages the backlog already covered are dropped by the id check in #send.
    */
    subscription.buffering = false;
    const buffered = subscription.buffer;
    subscription.buffer = [];
    for(const message of buffered){
      this.#send(subscriber, subscription, channel, message);
    }
  };

  /*
    Delivery
  */

  // Returns whether the message reached the client's socket; a duplicate, or one skipped because the client is behind, did not
  #send = (subscriber, subscription, channel, { id, data }) => {
    if(id !== undefined && id !== null){
      if(subscription.lastId !== null && id <= subscription.lastId) return false;
      subscription.lastId = id;
    }

    const frame = { type: 'message', channel, data };
    if(id !== undefined && id !== null) frame.id = id;
    return this.#deliverFrame(subscriber, frame, subscription.dropIfBackedUp ? { dropIfBackedUp: true } : undefined);
  };

  #deliverFrame = (subscriber, frame, options) => {
    try {
      return subscriber.deliver(frame, options) !== false;
    } catch(error) {
      this.#log.error(`[realtime] delivery to ${subscriber.id} failed: ${error.message}`);
      return false;
    }
  };

  #forget = (id, channel) => {
    const ids = this.#channels.get(channel);
    if(!ids) return;
    ids.delete(id);
    if(!ids.size) this.#channels.delete(channel);
  };

  /*
    Sessions

    A socket authenticates once, when it connects, but it can outlive the session that let it in: the
    user signs out, the session expires, a password change revokes them. So the sessions behind open
    sockets are re-checked on an interval, and a socket whose session has ended is closed. A database
    error is not treated as an ended session, so a blip cannot disconnect everyone.
  */

  #startSessionTimer = () => {
    if(this.#sessionTimer) return;
    this.#sessionTimer = setInterval(() => this.#checkSessions(), this.#sessionCheckMs);
    this.#sessionTimer.unref?.();
  };

  #stopSessionTimer = () => {
    if(this.#sessionTimer) clearInterval(this.#sessionTimer);
    this.#sessionTimer = null;
  };

  #checkSessions = async () => {
    if(this.#checkingSessions) return;
    this.#checkingSessions = true;

    try {
      const byToken = new Map();
      for(const subscriber of this.#subscribers.values()){
        if(!byToken.has(subscriber.token)) byToken.set(subscriber.token, []);
        byToken.get(subscriber.token).push(subscriber);
      }

      for(const [token, subscribers] of byToken){
        const [error] = await getSession({ token });
        if(!error || error.code !== 404) continue;

        for(const subscriber of subscribers){
          this.closeConnection({ connectionId: subscriber.id, code: SESSION_CLOSE_CODE, reason: 'Session ended' });
        }
      }
    } finally {
      this.#checkingSessions = false;
    }
  };
}
