import crypto from 'crypto';
import postgres from 'postgres';
import { and, asc, eq, gt } from 'drizzle-orm';
import db from '../../db/index.js';
import { realtimeMessage, realtimeChannel } from '../../db/schema.js';
import getSession from '../auth/getSession.js';
import pruneMessages from './pruneMessages.js';
import { resolveChannel, authorizeSubscription } from './channels.js';
import { BUS_CHANNEL, SESSION_CLOSE_CODE } from './constants.js';

const BACKLOG_BATCH = 500;
const DEFAULT_SESSION_CHECK_MS = 30000;
const DEFAULT_PRUNE_MS = 10 * 60 * 1000;

/*
  The realtime state of one process: who is connected, what they are subscribed to, and the connection
  that listens for messages published anywhere.

  Delivery has one path. A publish becomes a Postgres NOTIFY, every process holding subscribers is
  listening, and each delivers to its own. A process therefore only ever talks to its own sockets, which
  is what lets several kempo processes share one database and behave as one system.
*/
export default class Hub {
  #databaseUrl;
  #sessionCheckMs;
  #pruneMs;
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
    log = console
  } = {}){
    this.#databaseUrl = databaseUrl;
    this.#sessionCheckMs = sessionCheckMs;
    this.#pruneMs = pruneMs;
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
      subscriptions: new Map()
    });

    this.#startSessionTimer();
    return [null, { id }];
  };

  removeSubscriber = ({ id } = {}) => {
    const subscriber = this.#subscribers.get(id);
    if(!subscriber) return [null, { removed: false }];

    for(const channel of subscriber.subscriptions.keys()){
      this.#forget(id, channel);
    }
    this.#subscribers.delete(id);

    if(!this.#subscribers.size) this.#stopSessionTimer();
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

    try {
      await this.#ensureBus();
    } catch(error) {
      this.#log.error(`[realtime] could not start the listening connection: ${error.message}`);
      return [{ code: 503, msg: 'Realtime is unavailable' }, null];
    }

    // The connection may have closed, or the same channel been requested again, while the awaits above ran
    if(!this.#subscribers.has(id)) return [{ code: 410, msg: 'Subscriber is gone' }, null];
    if(subscriber.subscriptions.has(channel)) return [null, { channel, subscribed: true }];

    const replay = config.persist && since !== undefined && since !== null;
    const subscription = { buffering: replay, buffer: [], lastId: replay ? since : null };

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

    return [null, { channel, subscribed: true }];
  };

  unsubscribe = ({ id, channel } = {}) => {
    const subscriber = this.#subscribers.get(id);
    if(!subscriber?.subscriptions.has(channel)) return [null, { unsubscribed: false }];

    subscriber.subscriptions.delete(channel);
    this.#forget(id, channel);
    return [null, { unsubscribed: true }];
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

  #send = (subscriber, subscription, channel, { id, data }) => {
    if(id !== undefined && id !== null){
      if(subscription.lastId !== null && id <= subscription.lastId) return;
      subscription.lastId = id;
    }

    const frame = { type: 'message', channel, data };
    if(id !== undefined && id !== null) frame.id = id;
    this.#deliverFrame(subscriber, frame);
  };

  #deliverFrame = (subscriber, frame) => {
    try {
      subscriber.deliver(frame);
    } catch(error) {
      this.#log.error(`[realtime] delivery to ${subscriber.id} failed: ${error.message}`);
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
          try {
            subscriber.close(SESSION_CLOSE_CODE, 'Session ended');
          } catch(closeError) {
            this.#log.error(`[realtime] could not close ${subscriber.id}: ${closeError.message}`);
          }
          this.removeSubscriber({ id: subscriber.id });
        }
      }
    } finally {
      this.#checkingSessions = false;
    }
  };
}
