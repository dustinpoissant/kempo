// The one Postgres NOTIFY channel every kempo process listens on. Kempo channel names travel inside the payload.
export const BUS_CHANNEL = 'kempo_realtime';

/*
  NOTIFY payloads must be under 8000 bytes. A message on a channel that does not persist travels in the
  notification itself, so it is capped a little under that; a persisted message sends only its id.
*/
export const MAX_INLINE_BYTES = 7900;
export const MAX_PERSISTED_BYTES = 1000000;

export const LOCK_PREFIX = 'kempo:realtime:';

// In the 4000-4999 range reserved for applications. The browser client treats it as "do not reconnect".
export const SESSION_CLOSE_CODE = 4401;

// The user already holds as many connections as they are allowed. Retrying would be refused again, so the client stops.
export const TOO_MANY_CONNECTIONS_CODE = 4429;

// 1008, policy violation: the connection was sending far faster than a client should
export const RATE_LIMIT_CLOSE_CODE = 1008;
