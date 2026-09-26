/*
  Browser client for kempo's realtime socket.

    import { connect } from '/kempo/realtime.js';

    const realtime = connect();
    const stop = realtime.subscribe('my-extension:status', (data, { id }) => { ... }, {
      onGap: () => refetchEverything()
    });

    // Send to the channel's handler on the server, and wait for its reply
    const reply = await realtime.send('my-extension:status', { action: 'ping' });

  A browser does not reconnect a WebSocket that closes, so this does: with backoff, resubscribing to
  every channel and asking for what it missed since the last message it saw. It stops for good when the
  session has ended, since retrying could never succeed.
*/

const DEFAULT_PATH = '/kempo/api/realtime';
const SESSION_ENDED = 4401;
const TOO_MANY_CONNECTIONS = 4429;
const GOING_AWAY = 1001;

const defaultUrl = () => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${DEFAULT_PATH}`;

/*
  Distinguishes "signed out" from "the network is down". A failed handshake looks identical either way
  to a browser (a bare close with no status), so this asks the session endpoint. Only a definite answer
  that there is no session stops the retrying; anything unclear keeps trying.
*/
const defaultCheckSession = async () => {
  try {
    const response = await fetch('/kempo/api/auth/session');
    if(!response.ok) return true;
    const body = await response.json();
    return Boolean(body.user);
  } catch(error) {
    return true;
  }
};

export class RealtimeClient {
  #url;
  #WebSocketImpl;
  #checkSession;
  #base;
  #max;
  #random;
  #socket = null;
  #status = 'idle';
  #attempts = 0;
  #timer = null;
  #stopped = false;
  #subscriptions = new Map();
  #listeners = { status: new Set(), ready: new Set(), direct: new Set() };
  #pending = new Map();
  #nextRef = 1;

  userId = null;

  constructor({
    url,
    WebSocket: WebSocketImpl = globalThis.WebSocket,
    checkSession = defaultCheckSession,
    backoff = {},
    random = Math.random
  } = {}){
    this.#url = url;
    this.#WebSocketImpl = WebSocketImpl;
    this.#checkSession = checkSession;
    this.#base = backoff.base ?? 1000;
    this.#max = backoff.max ?? 30000;
    this.#random = random;
  }

  /*
    State
  */

  get status(){
    return this.#status;
  }

  onStatus = (listener) => {
    this.#listeners.status.add(listener);
    return () => this.#listeners.status.delete(listener);
  };

  onReady = (listener) => {
    this.#listeners.ready.add(listener);
    if(this.userId) listener(this.userId);
    return () => this.#listeners.ready.delete(listener);
  };

  // Messages the server sent to this connection alone, rather than to a channel
  onDirect = (listener) => {
    this.#listeners.direct.add(listener);
    return () => this.#listeners.direct.delete(listener);
  };

  /*
    Sending

    A message goes to the channel's handler on the server, and the promise settles with what the handler
    returned, or rejects with { code, msg }. It is not queued while disconnected: a message a game or an
    editor sends is stale by the time the connection comes back, so the caller is told it did not go.
  */

  send = (channel, data, { timeout = 10000 } = {}) => new Promise((resolve, reject) => {
    if(this.#socket?.readyState !== 1){
      reject({ code: 503, msg: 'Not connected' });
      return;
    }

    const ref = this.#nextRef++;
    const timer = setTimeout(() => {
      this.#pending.delete(ref);
      reject({ code: 504, msg: 'No reply from the server' });
    }, timeout);

    this.#pending.set(ref, { resolve, reject, timer });
    this.#send({ type: 'send', channel, data, ref });
  });

  /*
    Subscriptions

    Several handlers can share one channel; the server is only told when the first arrives and when the
    last leaves. `since` lets a caller that remembers the last id it processed (across a page load, say)
    resume from there rather than from now.
  */

  subscribe = (channel, handler, { since, onGap, onError } = {}) => {
    let subscription = this.#subscriptions.get(channel);

    if(!subscription){
      subscription = { handlers: new Set(), gapHandlers: new Set(), errorHandlers: new Set(), lastId: since ?? null, failed: false };
      this.#subscriptions.set(channel, subscription);
    }

    subscription.handlers.add(handler);
    if(onGap) subscription.gapHandlers.add(onGap);
    if(onError) subscription.errorHandlers.add(onError);

    // A repeat handler on a channel the server already confirmed needs no frame; a first one does
    if(subscription.handlers.size === 1) this.#sendSubscribe(channel, subscription);

    return () => {
      subscription.handlers.delete(handler);
      if(onGap) subscription.gapHandlers.delete(onGap);
      if(onError) subscription.errorHandlers.delete(onError);

      if(!subscription.handlers.size){
        this.#subscriptions.delete(channel);
        this.#send({ type: 'unsubscribe', channel });
      }
    };
  };

  /*
    Lifecycle
  */

  start = () => {
    if(this.#socket || this.#stopped) return;
    this.#open();
  };

  close = () => {
    this.#stopped = true;
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#rejectPending({ code: 503, msg: 'Client closed' });
    this.#setStatus('closed');
    this.#socket?.close(1000);
    this.#socket = null;
  };

  #open = () => {
    this.#setStatus(this.#attempts > 0 ? 'reconnecting' : 'connecting');

    let opened = false;
    let finished = false;
    const socket = new this.#WebSocketImpl(this.#url ?? defaultUrl());
    this.#socket = socket;

    // One attempt ends once, however many of error and close report it
    const finish = (code) => {
      if(finished) return;
      finished = true;
      if(this.#socket === socket) this.#socket = null;
      this.#rejectPending({ code: 503, msg: 'Connection lost' });
      this.#closed(code, opened);
    };

    socket.addEventListener('open', () => {
      opened = true;
      this.#attempts = 0;
      this.#setStatus('open');
      for(const [channel, subscription] of this.#subscriptions){
        this.#sendSubscribe(channel, subscription);
      }
    });

    socket.addEventListener('message', event => this.#received(event.data));

    socket.addEventListener('close', event => finish(event.code));

    /*
      A browser follows a failed connection with a close event; Node's WebSocket sends only the error. A
      client that waited for close would then never retry, so a failure before the socket opened ends the
      attempt on its own. After it opened, an error is always followed by a close carrying the real code.
    */
    socket.addEventListener('error', () => {
      if(!opened) finish(1006);
    });
  };

  #closed = async (code, opened) => {
    if(this.#stopped) return;

    if(code === SESSION_ENDED){
      this.#stopped = true;
      this.#setStatus('unauthenticated');
      return;
    }

    // The user is at their connection limit; reconnecting would only be refused again
    if(code === TOO_MANY_CONNECTIONS){
      this.#stopped = true;
      this.#setStatus('refused');
      return;
    }

    /*
      A handshake that never completed is either a network problem or a refused session, and the browser
      cannot say which, so ask. A restart (1001) is neither, so it skips the check and comes straight back.
    */
    if(!opened && code !== GOING_AWAY){
      const signedIn = await this.#checkSession();
      if(this.#stopped) return;
      if(signedIn === false){
        this.#stopped = true;
        this.#setStatus('unauthenticated');
        return;
      }
    }

    this.#setStatus('reconnecting');
    this.#attempts += code === GOING_AWAY ? 0 : 1;

    const exponential = Math.min(this.#max, this.#base * 2 ** Math.max(0, this.#attempts - 1));
    // Jitter, so a restart does not bring every client back in the same instant
    const delay = code === GOING_AWAY ? Math.min(250, this.#base) : exponential * (0.5 + this.#random() * 0.5);

    this.#timer = setTimeout(() => {
      this.#timer = null;
      if(!this.#stopped) this.#open();
    }, delay);
  };

  /*
    Frames
  */

  #sendSubscribe = (channel, subscription) => {
    if(subscription.failed) return;
    const frame = { type: 'subscribe', channel };
    if(subscription.lastId !== null) frame.since = subscription.lastId;
    this.#send(frame);
  };

  #send = (frame) => {
    if(this.#socket?.readyState === 1) this.#socket.send(JSON.stringify(frame));
  };

  #received = (raw) => {
    let frame;
    try {
      frame = JSON.parse(raw);
    } catch(error) {
      return;
    }

    if(frame.type === 'ready'){
      this.userId = frame.userId;
      for(const listener of this.#listeners.ready) listener(frame.userId);
      return;
    }

    if(frame.type === 'direct'){
      for(const listener of this.#listeners.direct) this.#safely(() => listener(frame.data));
      return;
    }

    // A reply to a send(), matched by its ref before anything is routed by channel
    if((frame.type === 'ack' || frame.type === 'error') && frame.ref !== undefined){
      const pending = this.#pending.get(frame.ref);
      if(!pending) return;
      this.#pending.delete(frame.ref);
      clearTimeout(pending.timer);
      if(frame.type === 'ack') pending.resolve(frame.data);
      else pending.reject({ code: frame.code, msg: frame.msg });
      return;
    }

    const subscription = this.#subscriptions.get(frame.channel);
    if(!subscription) return;

    if(frame.type === 'message'){
      if(frame.id !== undefined) subscription.lastId = frame.id;
      for(const handler of subscription.handlers) this.#safely(() => handler(frame.data, { channel: frame.channel, id: frame.id }));
      return;
    }

    if(frame.type === 'gap'){
      for(const handler of subscription.gapHandlers) this.#safely(() => handler({ channel: frame.channel }));
      return;
    }

    if(frame.type === 'error'){
      // A refused subscription would be refused again on every reconnect, so it is not retried
      subscription.failed = true;
      for(const handler of subscription.errorHandlers) this.#safely(() => handler({ channel: frame.channel, code: frame.code, msg: frame.msg }));
    }
  };

  #rejectPending = (error) => {
    for(const [ref, pending] of this.#pending){
      clearTimeout(pending.timer);
      pending.reject(error);
      this.#pending.delete(ref);
    }
  };

  // One handler throwing must not stop the others, or the frames behind it
  #safely = (fn) => {
    try {
      fn();
    } catch(error) {
      console.error('[kempo realtime] a handler threw:', error);
    }
  };

  #setStatus = (status) => {
    if(this.#status === status) return;
    this.#status = status;
    for(const listener of this.#listeners.status) this.#safely(() => listener(status));
  };
}

export const connect = (options) => {
  const client = new RealtimeClient(options);
  client.start();
  return client;
};
