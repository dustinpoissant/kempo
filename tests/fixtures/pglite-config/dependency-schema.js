import { pgTable, text } from 'drizzle-orm/pg-core';

export const fixtureDependencyTable = pgTable('fixtureDependencyTable', { id: text('id').primaryKey() });
