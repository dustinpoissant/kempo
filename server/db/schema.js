import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

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
