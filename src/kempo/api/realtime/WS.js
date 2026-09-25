import getSession from '../../../../server/utils/auth/getSession.js';
import getHub from '../../../../server/utils/realtime/getHub.js';

/*
  The realtime socket, served at /kempo/api/realtime.

  This is only the HTTP layer: it turns the session cookie into a user, hands frames to the hub, and
  hands the hub's frames back to the socket. Channels, authorization, delivery and replay all live in
  server/utils/realtime.

  Client to server: { type: 'subscribe', channel, since? } and { type: 'unsubscribe', channel }.
  Server to client: ready, subscribed, unsubscribed, message, gap and error frames.
*/
export default async (request, socket) => {
  const token = request.cookies.session_token;
  const [error, sessionData] = await getSession({ token });

  if(error){
    return error.code === 500
      ? socket.reject(500, 'Failed to verify session')
      : socket.reject(401, 'Authentication required');
  }

  const hub = getHub();
  const send = frame => socket.send(JSON.stringify(frame));
  let subscriberId = null;

  /*
    Registered on open rather than here. This route runs before the handshake completes, so a client
    that disconnects in between would otherwise leave a subscriber that no close event ever removes.
  */
  socket.on('open', () => {
    const [addError, added] = hub.addSubscriber({
      token,
      user: sessionData.user,
      path: request.path,
      deliver: send,
      close: (code, reason) => socket.close(code, reason)
    });

    if(addError){
      socket.close(1011, addError.msg);
      return;
    }

    subscriberId = added.id;
    socket.data.userId = sessionData.user.id;
    send({ type: 'ready', userId: sessionData.user.id });
  });

  socket.on('message', async (data, isBinary) => {
    if(!subscriberId) return;

    let frame;
    try {
      frame = isBinary ? null : JSON.parse(data);
    } catch(parseError) {
      frame = null;
    }
    if(!frame || typeof frame !== 'object'){
      return send({ type: 'error', code: 400, msg: 'Frames must be JSON objects' });
    }

    hub.touch({ id: subscriberId });

    if(frame.type === 'subscribe'){
      const [subscribeError] = await hub.subscribe({ id: subscriberId, channel: frame.channel, since: frame.since });
      if(subscribeError){
        send({ type: 'error', channel: frame.channel, code: subscribeError.code, msg: subscribeError.msg });
      }
      return;
    }

    if(frame.type === 'unsubscribe'){
      hub.unsubscribe({ id: subscriberId, channel: frame.channel });
      return send({ type: 'unsubscribed', channel: frame.channel });
    }

    send({ type: 'error', code: 400, msg: `Unknown frame type "${frame.type}"` });
  });

  socket.on('close', () => {
    if(subscriberId) hub.removeSubscriber({ id: subscriberId });
  });
};
