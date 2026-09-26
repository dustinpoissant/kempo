import { pgTable, text, timestamp, boolean, index, jsonb, bigserial, bigint } from 'drizzle-orm/pg-core';

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




