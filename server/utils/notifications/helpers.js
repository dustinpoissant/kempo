import { and, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { notification, notificationRecipient, notificationGuestRecipient } from '../../db/schema.js';

export const LEVELS = ['info', 'success', 'warning', 'error'];
export const API_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
export const MAX_ACTIONS = 3;
export const MAX_TITLE_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_LABEL_LENGTH = 40;
export const MAX_URL_LENGTH = 2048;
export const MAX_BODY_BYTES = 4096;
export const DEFAULT_RETENTION_DAYS = 90;
export const MAX_PAGE_SIZE = 100;

/*
  A path on this site and nothing else. It must begin with exactly one slash: `//host` and `/\\host`
  are read by browsers as another origin, and `javascript:` or `https:` URLs do not begin with a slash
  at all. Whitespace, backslashes and control characters are refused because browsers strip or
  rewrite some of them before resolving, which is how a path that looks safe becomes an external one.
*/
export const isLocalPath = value =>
  typeof value === 'string' &&
  value.length <= MAX_URL_LENGTH &&
  /^\/(?![/\\])[^\\\s\u0000-\u001f\u007f]*$/.test(value);

/*
  Returns the actions reduced to the known fields, so nothing a caller passes beyond them is stored.
  An action is either a link (`href`) or a call (`api`), never both.
*/
export const validateActions = actions => {
  if(actions === undefined || actions === null){
    return [null, []];
  }

  if(!Array.isArray(actions) || actions.length > MAX_ACTIONS){
    return [{ code: 400, msg: `actions must be an array of at most ${MAX_ACTIONS} items` }, null];
  }

  const clean = [];

  for(const action of actions){
    if(!action || typeof action !== 'object' || Array.isArray(action)){
      return [{ code: 400, msg: 'Each action must be an object' }, null];
    }

    const { label, href, api } = action;

    if(typeof label !== 'string' || !label.trim() || label.length > MAX_LABEL_LENGTH){
      return [{ code: 400, msg: `Each action needs a label of at most ${MAX_LABEL_LENGTH} characters` }, null];
    }

    if((href === undefined) === (api === undefined)){
      return [{ code: 400, msg: 'Each action needs exactly one of href or api' }, null];
    }

    if(href !== undefined){
      if(!isLocalPath(href)){
        return [{ code: 400, msg: 'An action href must be a path on this site, beginning with a single "/"' }, null];
      }
      clean.push({ label: label.trim(), href });
      continue;
    }

    if(!api || typeof api !== 'object' || Array.isArray(api)){
      return [{ code: 400, msg: 'An action api must be an object with a method and url' }, null];
    }

    const method = typeof api.method === 'string' ? api.method.toUpperCase() : '';

    if(!API_METHODS.includes(method)){
      return [{ code: 400, msg: `An action api method must be one of ${API_METHODS.join(', ')}` }, null];
    }

    if(!isLocalPath(api.url)){
      return [{ code: 400, msg: 'An action api url must be a path on this site, beginning with a single "/"' }, null];
    }

    const cleanApi = { method, url: api.url };

    if(api.body !== undefined){
      let serialized;
      try {
        serialized = JSON.stringify(api.body);
      } catch {
        serialized = undefined;
      }
      if(serialized === undefined || Buffer.byteLength(serialized) > MAX_BODY_BYTES){
        return [{ code: 400, msg: `An action api body must be JSON of at most ${MAX_BODY_BYTES} bytes` }, null];
      }
      cleanApi.body = JSON.parse(serialized);
    }

    clean.push({ label: label.trim(), api: cleanApi });
  }

  return [null, clean];
};

/*
  The types kempo's own browser client knows how to show. A type is any short word, and one that is not in
  this list is an extension's own: it is delivered to whatever the extension put on the page to receive it
  and ignored by everything else.
*/
export const CORE_TYPES = ['toast', 'banner', 'notice', 'modal', 'inline'];
export const DEFAULT_TYPE = 'notice';
export const MAX_NAME_LENGTH = 50;
export const MAX_SECONDS = 31536000;

/* A type or subtype is a word, not text to show: it ends up in attributes and class names. */
export const isName = value => typeof value === 'string' && new RegExp(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,${MAX_NAME_LENGTH - 1}}$`).test(value);

export const STATUSES = ['pending', 'delivered', 'viewed', 'acknowledged', 'dismissed', 'expired'];

/*
  Who a notification belongs to: a user or a guest session. Both have the same state in a table of their own,
  so every read and write takes `{ userId }` or `{ guestSessionId }` and gets the table and column to use.
  Returns null when neither is given.
*/
export const recipientOf = ({ userId, guestSessionId } = {}) => {
  if(userId){
    return { table: notificationRecipient, column: notificationRecipient.userId, id: userId };
  }
  if(guestSessionId){
    return { table: notificationGuestRecipient, column: notificationGuestRecipient.guestSessionId, id: guestSessionId };
  }
  return null;
};

/*
  The status of a notification for one person, from their timestamps: dismissed beats acknowledged beats
  viewed beats delivered beats pending. Nothing stores it, so it cannot disagree with them. Whether the
  notification has expired is separate (`expired`), since it depends on the clock and not on the person.
*/
export const statusOf = row => {
  if(row.dismissedAt) return 'dismissed';
  if(row.acknowledgedAt) return 'acknowledged';
  if(row.viewedAt) return 'viewed';
  if(row.deliveredAt) return 'delivered';
  return 'pending';
};

/* The level an older reader expects: a subtype that is one of the four levels, else info. */
export const levelOf = subtype => (LEVELS.includes(subtype) ? subtype : 'info');

/* One notification as the browser and the SDK see it. */
export const present = (row, now = new Date()) => ({
  id: row.id,
  owner: row.owner,
  type: row.type,
  subtype: row.subtype,
  level: levelOf(row.subtype),
  title: row.title,
  message: row.message,
  actions: row.actions,
  priority: row.priority,
  mustAcknowledge: row.mustAcknowledge,
  cooldownSeconds: row.cooldownSeconds,
  displaySeconds: row.displaySeconds,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  expiresAt: row.expiresAt,
  deliveredAt: row.deliveredAt,
  viewedAt: row.viewedAt,
  acknowledgedAt: row.acknowledgedAt,
  dismissedAt: row.dismissedAt,
  lastShownAt: row.lastShownAt,
  status: statusOf(row),
  expired: Boolean(row.expiresAt && new Date(row.expiresAt) <= now),
});

/* The columns `present` reads, for a select over a notification joined to someone's state. */
export const selection = state => ({
  id: notification.id,
  owner: notification.owner,
  type: notification.type,
  subtype: notification.subtype,
  title: notification.title,
  message: notification.message,
  actions: notification.actions,
  priority: notification.priority,
  mustAcknowledge: notification.mustAcknowledge,
  cooldownSeconds: notification.cooldownSeconds,
  displaySeconds: notification.displaySeconds,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
  expiresAt: notification.expiresAt,
  deliveredAt: state.table.deliveredAt,
  viewedAt: state.table.viewedAt,
  acknowledgedAt: state.table.acknowledgedAt,
  dismissedAt: state.table.dismissedAt,
  lastShownAt: state.table.lastShownAt,
});

export const notExpired = now => or(isNull(notification.expiresAt), gt(notification.expiresAt, now));

/*
  A `status` filter as a condition. 'active' (the default) is what a person still has: not dismissed and not
  expired. 'all' is everything. The others are the statuses, where 'expired' is by the clock and the rest are by the
  person's timestamps, and a notification that has expired is only ever found as 'expired'.
*/
export const statusCondition = (state, status, now) => {
  const t = state.table;
  switch(status){
    case 'all': return undefined;
    case 'expired': return and(isNotNull(notification.expiresAt), lte(notification.expiresAt, now));
    case 'dismissed': return isNotNull(t.dismissedAt);
    case 'acknowledged': return and(notExpired(now), isNotNull(t.acknowledgedAt), isNull(t.dismissedAt));
    case 'viewed': return and(notExpired(now), isNotNull(t.viewedAt), isNull(t.acknowledgedAt), isNull(t.dismissedAt));
    case 'delivered': return and(notExpired(now), isNotNull(t.deliveredAt), isNull(t.viewedAt), isNull(t.acknowledgedAt), isNull(t.dismissedAt));
    case 'pending': return and(notExpired(now), isNull(t.deliveredAt), isNull(t.viewedAt), isNull(t.acknowledgedAt), isNull(t.dismissedAt));
    default: return and(notExpired(now), isNull(t.dismissedAt));
  }
};

export const isStatusFilter = status => status === undefined || status === 'all' || status === 'active' || STATUSES.includes(status);

/* Sets a timestamp to `now` unless it already has one, so the first time something happened is the time kept. */
export const firstTime = (column, now) => sql`coalesce(${column}, ${now.toISOString()}::timestamp)`;
