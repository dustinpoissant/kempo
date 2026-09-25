import { RealtimeClient, connect } from '../src/kempo/realtime.js';

/*
  The browser client, driven through a fake WebSocket so reconnection, backoff and resubscription can be
  checked exactly. None of this needs a database.
*/

const expect = (condition, message) => {
  if(!condition) throw new Error(message);
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const until = async (condition, description, timeout = 2000) => {
  const deadline = Date.now() + timeout;
  while(Date.now() < deadline){
    if(condition()) return;
    await wait(5);
  }
  throw new Error(`timed out waiting for ${description}`);
};

/*
  Records what the client does and lets the test play the server: open, send a frame, close with a code.
*/
const makeFakeWebSocket = () => {
  const sockets = [];

  class FakeWebSocket {
    constructor(url){
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      this.listeners = { open: [], message: [], close: [], error: [] };
      this.createdAt = Date.now();
      sockets.push(this);
    }

    addEventListener(type, listener){
      this.listeners[type].push(listener);
    }

    send(data){
      this.sent.push(JSON.parse(data));
    }

    close(code){
      this.closedByClient = code;
      this.readyState = 3;
    }

    serverOpens(){
      this.readyState = 1;
      for(const listener of this.listeners.open) listener({});
    }

    serverSends(frame){
      for(const listener of this.listeners.message) listener({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
    }

    serverErrors(){
      for(const listener of this.listeners.error) listener({});
    }

    serverCloses(code){
      this.readyState = 3;
      for(const listener of this.listeners.close) listener({ code });
    }
  }

  FakeWebSocket.sockets = sockets;
  return FakeWebSocket;
};

const makeClient = (options = {}) => {
  const FakeWebSocket = makeFakeWebSocket();
  const client = new RealtimeClient({
    url: 'ws://test/kempo/api/realtime',
    WebSocket: FakeWebSocket,
    backoff: { base: 10, max: 80 },
    random: () => 1,
    checkSession: async () => true,
    ...options
  });
  client.start();
  return { client, sockets: FakeWebSocket.sockets };
};

export default {
  'subscribing before the socket opens sends the subscription once it does': async ({ pass }) => {
    const { client, sockets } = makeClient();
    client.subscribe('ext:a', () => {});
    expect(sockets[0].sent.length === 0, 'nothing can be sent before the socket is open');
    expect(client.status === 'connecting', `status should be connecting, got ${client.status}`);

    sockets[0].serverOpens();
    expect(client.status === 'open', 'status should be open');
    expect(JSON.stringify(sockets[0].sent) === JSON.stringify([{ type: 'subscribe', channel: 'ext:a' }]), `unexpected frames ${JSON.stringify(sockets[0].sent)}`);
    client.close();
    pass('subscribe on open');
  },

  'handlers receive the data, the channel and the id, and other channels are not crossed': async ({ pass }) => {
    const { client, sockets } = makeClient();
    const seenA = [];
    const seenB = [];
    client.subscribe('ext:a', (data, meta) => seenA.push([data, meta]));
    client.subscribe('ext:b', (data) => seenB.push(data));
    sockets[0].serverOpens();

    sockets[0].serverSends({ type: 'message', channel: 'ext:a', id: 7, data: { n: 1 } });
    sockets[0].serverSends({ type: 'message', channel: 'ext:b', data: 'b' });

    expect(JSON.stringify(seenA) === JSON.stringify([[{ n: 1 }, { channel: 'ext:a', id: 7 }]]), `unexpected ${JSON.stringify(seenA)}`);
    expect(JSON.stringify(seenB) === JSON.stringify(['b']), 'channel b should get only its own message');
    client.close();
    pass('delivery');
  },

  'after an abnormal close it reconnects and resubscribes from the last id it saw': async ({ pass }) => {
    const { client, sockets } = makeClient();
    client.subscribe('ext:persisted', () => {});
    client.subscribe('ext:live', () => {});
    sockets[0].serverOpens();
    sockets[0].serverSends({ type: 'message', channel: 'ext:persisted', id: 41, data: 1 });
    sockets[0].serverSends({ type: 'message', channel: 'ext:persisted', id: 42, data: 2 });
    sockets[0].serverSends({ type: 'message', channel: 'ext:live', data: 3 });

    sockets[0].serverCloses(1006);
    expect(client.status === 'reconnecting', `status should be reconnecting, got ${client.status}`);
    await until(() => sockets.length === 2, 'a second socket');
    sockets[1].serverOpens();

    const frames = sockets[1].sent;
    expect(frames.some(f => f.channel === 'ext:persisted' && f.since === 42), `should resume ext:persisted from 42, sent ${JSON.stringify(frames)}`);
    const live = frames.find(f => f.channel === 'ext:live');
    expect(live && !('since' in live), 'a channel that never carried an id has nothing to resume with');
    expect(client.status === 'open', 'should be open again');
    client.close();
    pass('resubscribe');
  },

  'a server restart (1001) reconnects promptly without asking about the session': async ({ pass }) => {
    let checks = 0;
    const { client, sockets } = makeClient({ checkSession: async () => { checks++; return true; }, backoff: { base: 5000, max: 30000 } });
    client.subscribe('ext:a', () => {});
    sockets[0].serverOpens();
    sockets[0].serverCloses(1001);

    // With a 5 second base backoff, a prompt reconnect proves the restart path ignored it
    await until(() => sockets.length === 2, 'a prompt reconnect', 1000);
    expect(checks === 0, 'a restart is not a session problem, so the session must not be checked');
    client.close();
    pass('1001');
  },

  'a handshake that never completes checks the session, and stops if it has ended': async ({ pass }) => {
    let checks = 0;
    const { client, sockets } = makeClient({ checkSession: async () => { checks++; return false; } });
    client.subscribe('ext:a', () => {});
    sockets[0].serverCloses(1006);

    await until(() => client.status === 'unauthenticated', 'the client to give up');
    await wait(120);
    expect(checks === 1, `the session should be checked once, was ${checks}`);
    expect(sockets.length === 1, 'it must not keep retrying once the session is known to be gone');
    pass('signed out');
  },

  'a handshake that never completes keeps retrying when the session is fine (the network is just down)': async ({ pass }) => {
    const { client, sockets } = makeClient({ checkSession: async () => true });
    client.subscribe('ext:a', () => {});
    sockets[0].serverCloses(1006);
    await until(() => sockets.length === 2, 'a retry');
    sockets[1].serverCloses(1006);
    await until(() => sockets.length === 3, 'another retry');
    expect(client.status === 'reconnecting', 'should still be reconnecting');
    client.close();
    pass('offline');
  },

  'a refused connection that only fires error, as Node does, still retries': async ({ pass }) => {
    // A browser fires error then close; Node's WebSocket fires only error. Waiting for close would never retry.
    const { client, sockets } = makeClient();
    client.subscribe('ext:a', () => {});
    sockets[0].serverErrors();

    await until(() => sockets.length === 2, 'a retry after an error with no close');
    sockets[1].serverErrors();
    await until(() => sockets.length === 3, 'a second retry');

    // In a browser both arrive; that must still be one attempt, not two retries
    sockets[2].serverErrors();
    sockets[2].serverCloses(1006);
    await wait(120);
    expect(sockets.length === 4, `error followed by close should schedule one retry, opened ${sockets.length - 3}`);
    client.close();
    pass('error without close');
  },

  'a session-ended close (4401) is final': async ({ pass }) => {
    const { client, sockets } = makeClient();
    client.subscribe('ext:a', () => {});
    sockets[0].serverOpens();
    sockets[0].serverCloses(4401);

    expect(client.status === 'unauthenticated', `expected unauthenticated, got ${client.status}`);
    await wait(150);
    expect(sockets.length === 1, 'it must not reconnect after the session ended');
    pass('4401');
  },

  'the delay between attempts grows and is capped': async ({ pass }) => {
    const { client, sockets } = makeClient({ backoff: { base: 20, max: 60 } });
    client.subscribe('ext:a', () => {});

    for(let attempt = 0; attempt < 4; attempt++){
      sockets[attempt].serverCloses(1006);
      await until(() => sockets.length === attempt + 2, `attempt ${attempt + 2}`, 1000);
    }

    const gaps = sockets.slice(1).map((socket, index) => socket.createdAt - sockets[index].createdAt);
    // base 20 doubling: 20, 40, then capped at 60, 60 (random pinned to 1 so there is no jitter)
    expect(gaps[1] > gaps[0] + 8, `the second delay should exceed the first, got ${gaps}`);
    expect(gaps[3] < 160, `the delay must be capped near 60ms, got ${gaps}`);
    client.close();
    pass('backoff');
  },

  'one server subscription is shared, and it is dropped only when the last handler leaves': async ({ pass }) => {
    const { client, sockets } = makeClient();
    sockets[0].serverOpens();

    const seenOne = [];
    const seenTwo = [];
    const stopOne = client.subscribe('ext:a', data => seenOne.push(data));
    const stopTwo = client.subscribe('ext:a', data => seenTwo.push(data));
    expect(sockets[0].sent.filter(f => f.type === 'subscribe').length === 1, 'the server should be told once');

    sockets[0].serverSends({ type: 'message', channel: 'ext:a', data: 'x' });
    expect(seenOne.length === 1 && seenTwo.length === 1, 'both handlers should receive it');

    stopOne();
    expect(!sockets[0].sent.some(f => f.type === 'unsubscribe'), 'one handler remains, so the server subscription must stay');
    sockets[0].serverSends({ type: 'message', channel: 'ext:a', data: 'y' });
    expect(seenOne.length === 1 && seenTwo.length === 2, 'the removed handler must stop, the other continue');

    stopTwo();
    expect(sockets[0].sent.some(f => f.type === 'unsubscribe' && f.channel === 'ext:a'), 'the last handler leaving should unsubscribe');
    client.close();
    pass('shared subscriptions');
  },

  'gap and error frames reach their handlers, and a refused channel is not retried': async ({ pass }) => {
    const { client, sockets } = makeClient();
    const gaps = [];
    const errors = [];
    client.subscribe('ext:a', () => {}, { onGap: g => gaps.push(g.channel) });
    client.subscribe('ext:forbidden', () => {}, { onError: e => errors.push(e) });
    sockets[0].serverOpens();

    sockets[0].serverSends({ type: 'gap', channel: 'ext:a' });
    sockets[0].serverSends({ type: 'error', channel: 'ext:forbidden', code: 403, msg: 'Not allowed' });
    expect(JSON.stringify(gaps) === JSON.stringify(['ext:a']), 'onGap should fire');
    expect(errors.length === 1 && errors[0].code === 403 && errors[0].channel === 'ext:forbidden', `onError should fire, got ${JSON.stringify(errors)}`);

    sockets[0].serverCloses(1006);
    await until(() => sockets.length === 2, 'a reconnect');
    sockets[1].serverOpens();
    expect(sockets[1].sent.some(f => f.channel === 'ext:a'), 'the good channel should be resubscribed');
    expect(!sockets[1].sent.some(f => f.channel === 'ext:forbidden'), 'a refused channel would only be refused again');
    client.close();
    pass('gap and error');
  },

  'a handler that throws does not stop the others or the frames behind it': async ({ pass }) => {
    const { client, sockets } = makeClient();
    const seen = [];
    const original = console.error;
    console.error = () => {};
    try {
      client.subscribe('ext:a', () => { throw new Error('boom'); });
      client.subscribe('ext:a', data => seen.push(data));
      sockets[0].serverOpens();

      sockets[0].serverSends({ type: 'message', channel: 'ext:a', data: 1 });
      sockets[0].serverSends({ type: 'message', channel: 'ext:a', data: 2 });
    } finally {
      console.error = original;
    }

    expect(JSON.stringify(seen) === JSON.stringify([1, 2]), `the second handler should see both, got ${JSON.stringify(seen)}`);
    client.close();
    pass('handler isolation');
  },

  'close() stops for good': async ({ pass }) => {
    const { client, sockets } = makeClient();
    client.subscribe('ext:a', () => {});
    sockets[0].serverOpens();
    client.close();

    expect(client.status === 'closed', 'status should be closed');
    expect(sockets[0].closedByClient === 1000, 'it should close the socket normally');
    sockets[0].serverCloses(1000);
    await wait(150);
    expect(sockets.length === 1, 'a closed client must not reconnect');
    pass('close');
  },

  'ready reports the user id, and status listeners are told of changes': async ({ pass }) => {
    const { client, sockets } = makeClient();
    const statuses = [];
    const ready = [];
    client.onStatus(status => statuses.push(status));
    client.onReady(userId => ready.push(userId));

    sockets[0].serverOpens();
    sockets[0].serverSends({ type: 'ready', userId: 'user-123' });
    expect(client.userId === 'user-123' && JSON.stringify(ready) === JSON.stringify(['user-123']), 'ready should set userId and notify');
    expect(statuses.includes('open'), 'status listeners should hear about open');

    const late = [];
    client.onReady(userId => late.push(userId));
    expect(JSON.stringify(late) === JSON.stringify(['user-123']), 'a listener added after ready should still be told');
    client.close();
    pass('ready and status');
  },

  'malformed frames and frames for unknown channels are ignored': async ({ pass }) => {
    const { client, sockets } = makeClient();
    const seen = [];
    client.subscribe('ext:a', data => seen.push(data));
    sockets[0].serverOpens();

    sockets[0].serverSends('this is not json');
    sockets[0].serverSends({ type: 'message', channel: 'ext:unknown', data: 'x' });
    sockets[0].serverSends({ type: 'message', channel: 'ext:a', data: 'fine' });
    expect(JSON.stringify(seen) === JSON.stringify(['fine']), `only the valid frame should arrive, got ${JSON.stringify(seen)}`);
    client.close();
    pass('robustness');
  },

  'connect() builds a client and starts it': async ({ pass }) => {
    const FakeWebSocket = makeFakeWebSocket();
    const client = connect({ url: 'ws://test/x', WebSocket: FakeWebSocket });
    expect(FakeWebSocket.sockets.length === 1 && FakeWebSocket.sockets[0].url === 'ws://test/x', 'connect should open a socket immediately');
    client.close();
    pass('connect');
  }
};
