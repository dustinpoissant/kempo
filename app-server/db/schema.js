import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/*
  App Tables

  Define your application-specific database tables here.
  Framework tables (user, session, group, permission, setting, etc.) are provided by kempo.

  You can reference framework tables in foreign keys:

  import { user } from 'kempo/server/db/schema.js';

  export const post = pgTable('post', {
    id: text('id').primaryKey(),
    authorId: text('authorId').references(() => user.id),
    title: text('title').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  });
*/
