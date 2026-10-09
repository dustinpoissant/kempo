import crypto from 'crypto';
import { eq, inArray, or, sql, getTableColumns } from 'drizzle-orm';
import db from '../../db/index.js';
import { notification, notificationRecipient, user, userGroup, groupPermission } from '../../db/schema.js';
import triggerHook from '../hooks/triggerHook.js';
import pruneNotifications from './pruneNotifications.js';
import { LEVELS, MAX_TITLE_LENGTH, MAX_MESSAGE_LENGTH, validateActions } from './helpers.js';

const PRUNE_INTERVAL_MS = 3600000;
const INSERT_CHUNK = 5000;
let lastPrune = 0;

const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

/*
  Sends a notification to the union of the people named by `userIds`, everyone who holds `permission`
  (through any group, and every Administrator), and every member of `group`.

  The recipients are fixed here, when it is created, and one row is written for each. That is what keeps
  a person's read state their own and keeps their history intact if they later lose the permission, or
  gain it after the notification was sent. The cost is a row per recipient for a broadcast.

  A `dedupeKey` makes (owner, dedupeKey) a single notification. Raising it again updates that notification
  in place and re-opens it for every recipient: unread, no longer handled, no longer dismissed. A person
  who read it and an unread one both end up with it unread and at the top of their list; people who
  received the earlier one but are not recipients this time are left as they were.

  Targets that resolve to nobody are not an error: nothing is stored and `notification` is null.
*/
export default async ({ owner, title, message = null, level = 'info', actions, dedupeKey = null, expiresAt = null, userIds, permission, group } = {}) => {
  if(!isText(owner, 100)){
    return [{ code: 400, msg: 'Owner is required' }, null];
  }

  if(!isText(title, MAX_TITLE_LENGTH)){
    return [{ code: 400, msg: `Title is required and must be at most ${MAX_TITLE_LENGTH} characters` }, null];
  }

  if(message !== null && !(typeof message === 'string' && message.length <= MAX_MESSAGE_LENGTH)){
    return [{ code: 400, msg: `Message must be a string of at most ${MAX_MESSAGE_LENGTH} characters` }, null];
  }

  if(!LEVELS.includes(level)){
    return [{ code: 400, msg: `Level must be one of ${LEVELS.join(', ')}` }, null];
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

  if(userIds === undefined && permission === undefined && group === undefined){
    return [{ code: 400, msg: 'At least one of userIds, permission or group is required' }, null];
  }

  if(userIds !== undefined && (!Array.isArray(userIds) || userIds.some(id => typeof id !== 'string' || !id))){
    return [{ code: 400, msg: 'userIds must be an array of user ids' }, null];
  }

  if((permission !== undefined && !isText(permission, 200)) || (group !== undefined && !isText(group, 200))){
    return [{ code: 400, msg: 'permission and group must be names' }, null];
  }

  try {
    const recipients = new Set();

    if(userIds?.length){
      const found = await db.select({ id: user.id }).from(user).where(inArray(user.id, [...new Set(userIds)]));
      found.forEach(row => recipients.add(row.id));
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

    if(!recipients.size){
      return [null, { notification: null, recipientIds: [], refreshed: false }];
    }

    const now = new Date();
    const recipientIds = [...recipients];

    const created = await db.transaction(async tx => {
      const [row] = await tx
        .insert(notification)
        .values({ id: crypto.randomUUID(), owner, title: title.trim(), message, level, actions: cleanActions, dedupeKey, createdAt: now, updatedAt: now, expiresAt: expires })
        .onConflictDoUpdate({
          target: [notification.owner, notification.dedupeKey],
          targetWhere: sql`${notification.dedupeKey} is not null`,
          set: { title: title.trim(), message, level, actions: cleanActions, updatedAt: now, expiresAt: expires }
        })
        .returning({ ...getTableColumns(notification), inserted: sql`(xmax = 0)`.mapWith(Boolean) });

      for(let i = 0; i < recipientIds.length; i += INSERT_CHUNK){
        await tx
          .insert(notificationRecipient)
          .values(recipientIds.slice(i, i + INSERT_CHUNK).map(userId => ({ notificationId: row.id, userId })))
          .onConflictDoUpdate({
            target: [notificationRecipient.notificationId, notificationRecipient.userId],
            set: { readAt: null, handledAt: null, dismissedAt: null }
          });
      }

      return row;
    });

    const { inserted, ...saved } = created;

    await triggerHook('notification:created', { notification: saved, recipientIds, refreshed: !inserted });

    if(Date.now() - lastPrune > PRUNE_INTERVAL_MS){
      lastPrune = Date.now();
      pruneNotifications().catch(() => {});
    }

    return [null, { notification: saved, recipientIds, refreshed: !inserted }];
  } catch(error) {
    return [{ code: 500, msg: 'Failed to create notification' }, null];
  }
};
