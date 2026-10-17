import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, boolean, index, uniqueIndex, primaryKey, jsonb, bigserial, bigint, integer } from 'drizzle-orm/pg-core';

/*
  Auth Tables
*/

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export const session = pgTable('session', {
  token: text('token').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
});

export const verificationToken = pgTable('verificationToken', {
  token: text('token').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  type: text('type').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

/*
  Group-Based Permission System
*/

export const group = pgTable('group', {
  name: text('name').primaryKey(),
  description: text('description'),
  owner: text('owner').notNull().default('user'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt'),
});

export const userGroup = pgTable('userGroup', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  groupName: text('groupName')
    .notNull()
    .references(() => group.name),
  createdAt: timestamp('createdAt').notNull(),
});

export const permission = pgTable('permission', {
  name: text('name').primaryKey(),
  description: text('description'),
  owner: text('owner').notNull().default('user'),
  createdAt: timestamp('createdAt').notNull(),
});

export const groupPermission = pgTable('groupPermission', {
  id: text('id').primaryKey(),
  groupName: text('groupName')
    .notNull()
    .references(() => group.name),
  permissionName: text('permissionName')
    .notNull()
    .references(() => permission.name),
  createdAt: timestamp('createdAt').notNull(),
});

/*
  Settings System
*/

export const setting = pgTable('setting', {
  name: text('name').primaryKey(),
  value: text('value'),
  type: text('type').notNull().default('string'),
  isPublic: boolean('isPublic').notNull().default(false),
  description: text('description'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

/*
  Extension System
*/

export const hook = pgTable('hook', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  event: text('event').notNull(),
  callback: text('callback').notNull(),
  createdAt: timestamp('createdAt').notNull(),
}, table => [
  index('hook_event_idx').on(table.event),
  index('hook_owner_idx').on(table.owner),
]);

export const extension = pgTable('extension', {
  name: text('name').primaryKey(),
  version: text('version'),
  enabled: boolean('enabled').notNull().default(true),
  kempo: jsonb('kempo'),
  installedAt: timestamp('installedAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

/*
  Scheduled jobs: recurring work an extension declares in its kempo-config.json `jobs`. A row per job
  is the schedule and the lease: `nextRunAt` is when it is next due and `lockedUntil` is held while a
  process runs it, so several server processes sharing one database run each job once per interval.
  `lastStatus` is 'ok' or 'error'.
*/
export const scheduledJob = pgTable('scheduledJob', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  everyMs: integer('everyMs').notNull(),
  callback: text('callback').notNull(),
  nextRunAt: timestamp('nextRunAt').notNull(),
  lockedUntil: timestamp('lockedUntil'),
  lastRunAt: timestamp('lastRunAt'),
  lastStatus: text('lastStatus'),
  lastError: text('lastError'),
  createdAt: timestamp('createdAt').notNull(),
}, table => [
  index('scheduledJob_owner_idx').on(table.owner),
  index('scheduledJob_next_idx').on(table.nextRunAt),
]);

/*
  Realtime System
*/

/*
  A published message, kept only for channels that opt in to persistence. `id` is what a client
  hands back as `since` to replay what it missed, so it must be ordered within a channel: publish
  takes a per-channel lock, otherwise two rows could commit out of id order and a replay from the
  earlier id would skip the later-committing one for good.
*/
export const realtimeMessage = pgTable('realtimeMessage', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  channel: text('channel').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('createdAt').notNull(),
}, table => [
  index('realtimeMessage_channel_id_idx').on(table.channel, table.id),
  index('realtimeMessage_createdAt_idx').on(table.createdAt),
]);

/*
  How far a channel has been pruned. Ids are shared across channels, so a gap cannot be inferred from
  id arithmetic; a client whose `since` is below this watermark has provably missed messages.
*/
export const realtimeChannel = pgTable('realtimeChannel', {
  channel: text('channel').primaryKey(),
  prunedThrough: bigint('prunedThrough', { mode: 'number' }).notNull().default(0),
});

/*
  Notification System
*/

/*
  What happened, written once however many people it was sent to. `owner` is the extension name, or
  `kempo` for core. A `dedupeKey` makes (owner, dedupeKey) one row that is refreshed instead of repeated.
*/
export const notification = pgTable('notification', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  title: text('title').notNull(),
  message: text('message'),
  level: text('level').notNull().default('info'),
  actions: jsonb('actions').notNull().default([]),
  dedupeKey: text('dedupeKey'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  expiresAt: timestamp('expiresAt'),
}, table => [
  uniqueIndex('notification_owner_dedupeKey_idx').on(table.owner, table.dedupeKey).where(sql`${table.dedupeKey} is not null`),
  index('notification_updatedAt_idx').on(table.updatedAt),
]);

/*
  One row per person it was sent to, written when the notification is created so each person's read,
  handled and dismissed state is their own and their history does not change if they later lose the
  permission that earned them the notification.
*/
export const notificationRecipient = pgTable('notificationRecipient', {
  notificationId: text('notificationId')
    .notNull()
    .references(() => notification.id, { onDelete: 'cascade' }),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  readAt: timestamp('readAt'),
  handledAt: timestamp('handledAt'),
  dismissedAt: timestamp('dismissedAt'),
}, table => [
  primaryKey({ columns: [table.notificationId, table.userId] }),
  index('notificationRecipient_userId_idx').on(table.userId),
]);

/*
  Dashboard Widget System

  A tile an extension adds to the admin dashboard. `id` is `owner:key`, which is also what the browser
  stores its layout against. `element` is the custom element the dashboard creates and `module` is the
  script that defines it; the widget fetches its own data once it is on the page. Kempo's own widgets
  are not rows: they live in code (`server/utils/dashboard/coreWidgets.js`) so they need no seeding.
*/
export const dashboardWidget = pgTable('dashboardWidget', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  key: text('key').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  icon: text('icon'),
  iconSrc: text('iconSrc'),
  element: text('element').notNull(),
  module: text('module').notNull(),
  defaultWidth: integer('defaultWidth').notNull().default(2),
  defaultHeight: integer('defaultHeight').notNull().default(1),
  minWidth: integer('minWidth').notNull().default(1),
  maxWidth: integer('maxWidth').notNull().default(4),
  minHeight: integer('minHeight').notNull().default(1),
  maxHeight: integer('maxHeight').notNull().default(3),
  permission: text('permission'),
  actions: jsonb('actions').notNull().default([]),
  priority: integer('priority').notNull().default(100),
  defaultVisible: boolean('defaultVisible').notNull().default(true),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
}, table => [
  uniqueIndex('dashboardWidget_owner_key_idx').on(table.owner, table.key),
]);

/*
  Triggers to prevent deletion of system resources
*/
export const createSettingProtectionTrigger = () => `
CREATE OR REPLACE FUNCTION prevent_system_setting_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.name LIKE 'system:%' THEN
    RAISE EXCEPTION 'Cannot delete system settings';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_system_settings
BEFORE DELETE ON setting
FOR EACH ROW
EXECUTE FUNCTION prevent_system_setting_delete();
`;

export const createGroupProtectionTrigger = () => `
CREATE OR REPLACE FUNCTION prevent_system_group_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.owner = 'system' THEN
    RAISE EXCEPTION 'Cannot delete system groups';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_system_groups
BEFORE DELETE ON "group"
FOR EACH ROW
EXECUTE FUNCTION prevent_system_group_delete();
`;

export const createPermissionProtectionTrigger = () => `
CREATE OR REPLACE FUNCTION prevent_system_permission_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.owner = 'system' THEN
    RAISE EXCEPTION 'Cannot delete system permissions';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_system_permissions
BEFORE DELETE ON permission
FOR EACH ROW
EXECUTE FUNCTION prevent_system_permission_delete();
`;




