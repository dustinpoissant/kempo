import crypto from 'crypto';
import { and, eq, inArray, isNull, or, sql, getTableColumns } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification, notificationRecipient, notificationGuestRecipient, guestSession, user, userGroup, groupPermission } from '../../db/schema.js';
import triggerHook from '../hooks/triggerHook.js';
import pruneNotifications from './pruneNotifications.js';
import { LEVELS, MAX_TITLE_LENGTH, MAX_MESSAGE_LENGTH, MAX_SECONDS, DEFAULT_TYPE, isName, levelOf, validateActions } from './helpers.js';

const PRUNE_INTERVAL_MS = 3600000;
const INSERT_CHUNK = 5000;
let lastPrune = 0;

const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

const isSeconds = (value, min) => Number.isSafeInteger(value) && value >= min && value <= MAX_SECONDS;

const RESET = { deliveredAt: null, viewedAt: null, acknowledgedAt: null, dismissedAt: null, lastShownAt: null };

/*
  Sends a notification to the union of the people named by `userIds`, the guests named by `guestSessionIds`,
  everyone who holds `permission` (through any group, and every Administrator), and every member of `group`.

  `type` says how it is shown: `toast`, `banner`, `notice`, `modal` and `inline` are shown by kempo's own browser
  client, and any other word is an extension's own, delivered to whatever that extension put on the page.
  `subtype` refines it (`success`, `error`, `warning` and `info` are the ones kempo's types draw, and nothing
  stops another word being used). `level` is the older name for `subtype`.

  `priority` orders what is shown (higher first). `mustAcknowledge` keeps it coming back, no sooner than every
  `cooldownSeconds`, until the person acknowledges it; a `modal` always must. `displaySeconds` is how long a
  toast stays up. All three fall back to a system setting when they are not given.

  The recipients are fixed here, when it is created, and one row is written for each. That is what keeps
  a person's state their own and keeps their history intact if they later lose the permission, or
  gain it after the notification was sent. The cost is a row per recipient for a broadcast.

  A `dedupeKey` makes (owner, dedupeKey) a single notification. Raising it again updates that notification
  in place and re-opens it for every recipient: not delivered, viewed, acknowledged or dismissed. People
  who received the earlier one but are not recipients this time are left as they were.

  Targets that resolve to nobody are not an error: nothing is stored and `notification` is null.
*/
export default async ({
  owner,
  title,
  message = null,
  type = DEFAULT_TYPE,
  subtype,
  level,
  priority = 0,
  mustAcknowledge = false,
  cooldownSeconds = null,
  displaySeconds = null,
  actions,
  dedupeKey = null,
  expiresAt = null,
  userIds,
  guestSessionIds,
  permission,
  group,
} = {}) => {
  if(!isText(owner, 100)){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }

  if(!isText(title, MAX_TITLE_LENGTH)){
    return [{ code: 400, msg: `Title is required and must be at most ${MAX_TITLE_LENGTH} characters` }, null];
  }

  if(message !== null && !(typeof message === 'string' && message.length <= MAX_MESSAGE_LENGTH)){
    return [{ code: 400, msg: `Message must be a string of at most ${MAX_MESSAGE_LENGTH} characters` }, null];
  }

  if(!isName(type)){
    return [{ code: 400, msg: 'Type must be a short word of letters, numbers, dashes, underscores, dots or colons' }, null];
  }

  if(level !== undefined && !LEVELS.includes(level)){
    return [{ code: 400, msg: `Level must be one of ${LEVELS.join(', ')}` }, null];
  }

  const chosenSubtype = subtype ?? level ?? null;

  if(chosenSubtype !== null && !isName(chosenSubtype)){
    return [{ code: 400, msg: 'Subtype must be a short word of letters, numbers, dashes, underscores, dots or colons' }, null];
  }

  if(!Number.isSafeInteger(priority)){
    return [{ code: 400, msg: 'Priority must be a whole number' }, null];
  }

  if(typeof mustAcknowledge !== 'boolean'){
    return [{ code: 400, msg: 'mustAcknowledge must be true or false' }, null];
  }

  if(cooldownSeconds !== null && !isSeconds(cooldownSeconds, 0)){
    return [{ code: 400, msg: 'cooldownSeconds must be a whole number of seconds, 0 or more' }, null];
  }

  if(displaySeconds !== null && !isSeconds(displaySeconds, 1)){
    return [{ code: 400, msg: 'displaySeconds must be a whole number of seconds, 1 or more' }, null];
  }

  if(dedupeKey !== null && !isText(dedupeKey, 200)){
    return [{ code: 400, msg: 'dedupeKey must be a non-empty string of at most 200 characters' }, null];
  }

  const expires = expiresAt === null || expiresAt === undefined ? null : new Date(expiresAt);

  if(expires && (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now())){
    return [{ code: 400, msg: 'expiresAt must be a date in the future' }, null];
  }

  const [actionsError, cleanActions] = validateActions(actions);

  if(actionsError){
    return [actionsError, null];
  }

  if(userIds === undefined && guestSessionIds === undefined && permission === undefined && group === undefined){
    return [{ code: 400, msg: 'At least one of userIds, guestSessionIds, permission or group is required' }, null];
  }

  for(const [name, ids] of [['userIds', userIds], ['guestSessionIds', guestSessionIds]]){
    if(ids !== undefined && (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id))){
      return [{ code: 400, msg: `${name} must be an array of ids` }, null];
    }
  }

  if((permission !== undefined && !isText(permission, 200)) || (group !== undefined && !isText(group, 200))){
    return [{ code: 400, msg: 'permission and group must be names' }, null];
  }

  try {
    const recipients = new Set();
    const guests = new Set();

    if(userIds?.length){
      const found = await db.select({ id: user.id }).from(user).where(inArray(user.id, [...new Set(userIds)]));
      found.forEach(row => recipients.add(row.id));
    }

    if(guestSessionIds?.length){
      const found = await db.select({ id: guestSession.token }).from(guestSession)
        .where(and(inArray(guestSession.token, [...new Set(guestSessionIds)]), isNull(guestSession.mergedIntoUserId)));
      found.forEach(row => guests.add(row.id));
    }

    if(permission){
      const holders = await db
        .selectDistinct({ id: userGroup.userId })
        .from(userGroup)
        .where(or(
          eq(userGroup.groupName, 'system:Administrators'),
          inArray(userGroup.groupName, db.select({ name: groupPermission.groupName }).from(groupPermission).where(eq(groupPermission.permissionName, permission)))
        ));
      holders.forEach(row => recipients.add(row.id));
    }

    if(group){
      const members = await db.selectDistinct({ id: userGroup.userId }).from(userGroup).where(eq(userGroup.groupName, group));
      members.forEach(row => recipients.add(row.id));
    }

    if(!recipients.size && !guests.size){
      return [null, { notification: null, recipientIds: [], guestSessionIds: [], refreshed: false }];
    }

    const now = new Date();
    const recipientIds = [...recipients];
    const guestIds = [...guests];
    const fields = {
      title: title.trim(),
      message,
      level: levelOf(chosenSubtype),
      type,
      subtype: chosenSubtype,
      priority,
      mustAcknowledge: mustAcknowledge || type === 'modal',
      cooldownSeconds,
      displaySeconds,
      actions: cleanActions,
      expiresAt: expires,
    };

    const created = await db.transaction(async tx => {
      const [row] = await tx
        .insert(notification)
        .values({ id: crypto.randomUUID(), owner, dedupeKey, createdAt: now, updatedAt: now, ...fields })
        .onConflictDoUpdate({
          target: [notification.owner, notification.dedupeKey],
          targetWhere: sql`${notification.dedupeKey} is not null`,
          set: { ...fields, updatedAt: now }
        })
        .returning({ ...getTableColumns(notification), inserted: sql`(xmax = 0)`.mapWith(Boolean) });

      for(let i = 0; i < recipientIds.length; i += INSERT_CHUNK){
        await tx
          .insert(notificationRecipient)
          .values(recipientIds.slice(i, i + INSERT_CHUNK).map(userId => ({ notificationId: row.id, userId })))
          .onConflictDoUpdate({
            target: [notificationRecipient.notificationId, notificationRecipient.userId],
            set: RESET
          });
      }

      for(let i = 0; i < guestIds.length; i += INSERT_CHUNK){
        await tx
          .insert(notificationGuestRecipient)
          .values(guestIds.slice(i, i + INSERT_CHUNK).map(guestSessionId => ({ notificationId: row.id, guestSessionId })))
          .onConflictDoUpdate({
            target: [notificationGuestRecipient.notificationId, notificationGuestRecipient.guestSessionId],
            set: RESET
          });
      }

      return row;
    });

    const { inserted, ...saved } = created;

    await triggerHook('notification:created', { notification: saved, recipientIds, guestSessionIds: guestIds, refreshed: !inserted });

    if(Date.now() - lastPrune > PRUNE_INTERVAL_MS){
      lastPrune = Date.now();
      pruneNotifications().catch(() => {});
    }

    return [null, { notification: saved, recipientIds, guestSessionIds: guestIds, refreshed: !inserted }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to create notification' }, null];
  }
};
