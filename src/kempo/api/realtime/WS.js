import getSession from '../../../../server/utils/auth/getSession.js';
import getHub from '../../../../server/utils/realtime/getHub.js';
import { TOO_MANY_CONNECTIONS_CODE } from '../../../../server/utils/realtime/constants.js';

/*
  The realtime socket, served at /kempo/api/realtime.

  This is only the HTTP layer: it turns the session cookie into a user, hands frames to the hub, and
  hands the hub's frames back to the socket. Channels, authorization, delivery and replay all live in
  server/utils/realtime.

  Client to server: { type: 'subscribe', channel, since? }, { type: 'unsubscribe', channel } and
  { type: 'send', channel, data, ref? }. A send is handed to the channel's own handler; with a `ref` the
  handler's return value comes back as an ack carrying the same ref.
  Server to client: ready, subscribed, unsubscribed, message, direct, ack, gap and error frames.
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
  const send = (frame, options) => socket.send(JSON.stringify(frame), options);
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
      // The user is at their connection limit: retrying would be refused again, so tell the client to stop
      socket.close(addError.code === 429 ? TOO_MANY_CONNECTIONS_CODE : 1011, addError.msg);
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

    if(frame.type === 'send'){
      const [sendError, result] = await hub.handleMessage({ id: subscriberId, channel: frame.channel, data: frame.data });

      if(sendError){
        return send({ type: 'error', channel: frame.channel, ref: frame.ref, code: sendError.code, msg: sendError.msg });
      }
      if(frame.ref === undefined) return;

      try {
        return send({ type: 'ack', channel: frame.channel, ref: frame.ref, data: result });
      } catch(serializeError) {
        return send({ type: 'error', channel: frame.channel, ref: frame.ref, code: 500, msg: 'The handler returned something that cannot be sent' });
      }
    }

    if(frame.type === 'unsubscribe'){
      hub.unsubscribe({ id: subscriberId, channel: frame.channel });
      return send({ type: 'unsubscribed', channel: frame.channel });
    }

    send({ type: 'error', code: 400, msg: `Unknown frame type "${frame.type}"` });
  });

  socket.on('close', (code) => {
    if(subscriberId) hub.removeSubscriber({ id: subscriberId, reason: code });
  });
};
